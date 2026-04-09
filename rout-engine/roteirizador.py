"""
roteirizador.py  —  rout-engine/roteirizador.py
------------------------------------------------
Motor principal do Logibot - Versão Produção
"""

import os
import logging
import requests
import threading
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

from geocodificador import geocodificar_entrega

# ------------------------------------------------------------------
# Setup e Configurações
# ------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

ENDERECO_BASE = "Rodovia Alkindar Monteiro Junqueira, Itatiba, SP"

# ------------------------------------------------------------------
# Funções de Apoio (Mantidas e Otimizadas)
# ------------------------------------------------------------------

def geocodificar_base() -> tuple:
    # 1. COORDENADAS FIXAS DA E4LOG (ITATIBA)
    # Essas são as coordenadas reais da Rod. Alkindar Monteiro Junqueira, 30
    LAT_ESTATICA = -23.0116
    LNG_ESTATICA = -46.8125

    import time
    headers = {"User-Agent": "Logibot/1.0 (contato@e4log.com.br)"}
    
    try:
        # Tentamos buscar na internet para manter a flexibilidade
        time.sleep(1.2) # Respeita o limite do Nominatim
        res = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": ENDERECO_BASE, "format": "json", "limit": 1},
            headers=headers,
            timeout=10,
        )
        
        # Se a resposta for OK (JSON), usamos ela
        if res.status_code == 200:
            data = res.json()
            if data:
                logger.info("📍 Base localizada via API.")
                return float(data[0]["lat"]), float(data[0]["lon"])
        
        # Se a API falhar ou vier vazia, usamos o PLANO B (Coordenada Fixa)
        logger.warning("⚠️ API de Mapas falhou. Usando localização fixa da E4Log.")
        return LAT_ESTATICA, LNG_ESTATICA

    except Exception as e:
        logger.error(f"Erro ao geocodificar base: {e}. Usando fallback estático.")
        # Se der qualquer erro (Internet, JSON, etc), retorna a fixa
        return LAT_ESTATICA, LNG_ESTATICA

def get_osrm_matrix(locais: list) -> list | None:
    coords = ";".join(f"{loc['lng']},{loc['lat']}" for loc in locais)
    url = f"http://router.project-osrm.org/table/v1/driving/{coords}?annotations=distance"
    try:
        res = requests.get(url, timeout=30).json()
        if res.get("code") == "Ok":
            return res["distances"]
        logger.error(f"OSRM erro: {res.get('message')}")
    except Exception as e:
        logger.error(f"Erro de conexão OSRM: {e}")
    return None

def calcular_financeiro(viagem_id: str, metros_totais: float):
    km_total = metros_totais / 1000
    try:
        res = supabase.table("viagens").select("*, veiculos(consumo_medio)").eq("id", viagem_id).single().execute()
        dados = res.data
        consumo_medio = dados.get("veiculos", {}).get("consumo_medio") or 2.5
        
        res_diesel = supabase.table("parametros_financeiros").select("preco_diesel").order("created_at", desc=True).limit(1).execute()
        preco_diesel_atual = float(res_diesel.data[0]['preco_diesel']) if res_diesel.data else 6.00
            
        custo = (km_total / consumo_medio) * preco_diesel_atual
        
        supabase.table("viagens").update({
            "km_total_estimado": round(km_total, 2),
            "custo_diesel_estimado": round(custo, 2)
        }).eq("id", viagem_id).execute()
        
        logger.info(f"💰 FINANCEIRO: {km_total:.2f} km | R$ {custo:.2f} diesel")
    except Exception as e:
        logger.warning(f"Erro no cálculo financeiro: {e}")

def resolver_geocodificacao(entregas: list) -> list:
    resultado = []
    for e in entregas:
        lat, lng = e.get("lat"), e.get("lng")
        if lat and lng:
            resultado.append({**e, "lat": lat, "lng": lng})
            continue

        lat, lng, camada = geocodificar_entrega(e)
        if lat and lng:
            supabase.table("entregas").update({
                "lat": lat, "lng": lng, "geocod_camada": camada,
            }).eq("id", e["id"]).execute()
            resultado.append({**e, "lat": lat, "lng": lng})
    return resultado

# ------------------------------------------------------------------
# Lógica Principal de Otimização
# ------------------------------------------------------------------

def processar_viagem_especifica(viagem_id):
    """Executa a roteirização para uma viagem específica disparada pela API"""
    try:
        # --- INÍCIO DA PARTE INSERIDA (PROTEÇÃO DA BASE) ---
        try:
            lat_base, lng_base = geocodificar_base()
            if not lat_base:
                raise ValueError("Serviço de mapas não retornou a base")
        except Exception as e:
            logger.error(f"⚠️ Alerta: Erro ao geocodificar base da E4log: {e}")
            # Usando coordenadas padrão de Itatiba/SP para o sistema não travar
            # Assim a viagem segue e você consegue ver o erro no log depois
            lat_base, lng_base = -23.00, -46.84 
            logger.info("📍 Usando coordenada padrão de Itatiba para evitar travamento.")
        # --- FIM DA PARTE INSERIDA ---

        # Busca dados da viagem
        viagem = supabase.table("viagens").select("*").eq("id", viagem_id).single().execute().data
        if not viagem: 
            logger.error(f"❌ Viagem {viagem_id} não encontrada no banco.")
            return

        # Busca entregas
        entregas = supabase.table("entregas").select("id, cliente_nome, numero_nf, lat, lng, cep, endereco_texto") \
            .eq("viagem_id", viagem_id).execute().data

        if not entregas: 
            logger.warning(f"⚠️ Viagem {viagem_id} não possui entregas vinculadas.")
            return

        entregas_geo = resolver_geocodificacao(entregas)
        locais = [{"lat": lat_base, "lng": lng_base, "id": "BASE"}]
        
        for e in entregas_geo:
            # Se a entrega não tiver lat/lng, o OSRM vai dar erro. 
            # Garantimos que só entram locais com coordenadas.
            if e.get("lat") and e.get("lng"):
                locais.append({
                    "lat": e["lat"], 
                    "lng": e["lng"], 
                    "id": e["id"], 
                    "nf": e.get("numero_nf"), 
                    "nome": e.get("cliente_nome")
                })

        if len(locais) <= 1: 
            logger.error("❌ Nenhum local válido para roteirizar após geocodificação.")
            return

        matriz = get_osrm_matrix(locais)
        if not matriz: 
            logger.error("❌ Erro ao obter matriz de distância do OSRM.")
            return

        # ... (Restante do código do OR-Tools continua igual)
        manager = pywrapcp.RoutingIndexManager(len(locais), 1, 0)
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            return int(matriz[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)])

        cb_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(cb_index)
        params = pywrapcp.DefaultRoutingSearchParameters()
        params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC

        solution = routing.SolveWithParameters(params)
        
        if not solution: 
            logger.error("❌ Otimizador OR-Tools não encontrou uma solução.")
            return

        # Distancia de operacao sem retorno ao deposito (evita inflar km/custo).
        distancia_total_metros = 0
        index = routing.Start(0)
        ordem = 1
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            if not routing.IsEnd(next_index):
                next_node = manager.IndexToNode(next_index)
                distancia_total_metros += matriz[node][next_node]
            if node != 0:
                local = locais[node]
                supabase.table("entregas").update({
                    "ordem_entrega": ordem,
                    "status_entrega": "roteirizado",
                }).eq("id", local["id"]).execute()
                ordem += 1
            index = next_index

        # Finalização
        calcular_financeiro(viagem_id, distancia_total_metros)
        supabase.table("viagens").update({"status": "roteirizado"}).eq("id", viagem_id).execute()
        logger.info(f"💾 Viagem {viagem_id} finalizada com sucesso.")

    except Exception as e:
        logger.error(f"❌ Erro crítico no processar_viagem_especifica {viagem_id}: {e}")

# ------------------------------------------------------------------
# Servidor de Produção (Flask)
# ------------------------------------------------------------------

app = Flask(__name__)
CORS(app)

@app.route('/api/roteirizar', methods=['POST'])
def acionar_roteirizador():
    dados = request.get_json()
    viagem_id = dados.get('viagem_id')

    if not viagem_id:
        return jsonify({"status": "erro", "mensage": "viagem_id ausente"}), 400

    logger.info(f"🚀 Gatilho recebido para a viagem: {viagem_id}")

    # A MÁGICA: Dispara o cálculo em uma thread separada e LIBERA o Flask na hora
    thread = threading.Thread(target=processar_viagem_especifica, args=(viagem_id,))
    thread.start()

    # Retorna o OK imediatamente para o Postman/Site não travarem
    return jsonify({
        "status": "sucesso", 
        "mensagem": "Roteirização iniciada em segundo plano. Verifique a Torre em instantes."
    }), 200

if __name__ == "__main__":
    logger.info("🟢 Motor Logibot Ligado (Porta 5000)")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
