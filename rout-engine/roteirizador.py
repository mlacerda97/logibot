"""
roteirizador.py  â€”  rout-engine/roteirizador.py
------------------------------------------------
Motor principal do Logibot - VersÃ£o ProduÃ§Ã£o
"""

import os
import math
import time
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
# Setup e ConfiguraÃ§Ãµes
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
OSRM_TABLE_ENDPOINTS_DEFAULT = [
    "https://router.project-osrm.org/table/v1/driving",
    "http://router.project-osrm.org/table/v1/driving",
    "https://routing.openstreetmap.de/routed-car/table/v1/driving",
]

osrm_endpoints_env = os.environ.get("OSRM_ENDPOINTS", "").strip()
if osrm_endpoints_env:
    OSRM_TABLE_ENDPOINTS = [item.strip() for item in osrm_endpoints_env.split(",") if item.strip()]
else:
    OSRM_TABLE_ENDPOINTS = OSRM_TABLE_ENDPOINTS_DEFAULT
OSRM_MAX_ATTEMPTS = int(os.environ.get("OSRM_MAX_ATTEMPTS", "2"))
OSRM_CONNECT_TIMEOUT = int(os.environ.get("OSRM_CONNECT_TIMEOUT", "5"))
OSRM_READ_TIMEOUT = int(os.environ.get("OSRM_READ_TIMEOUT", "12"))
OSRM_MAX_TOTAL_SECONDS = int(os.environ.get("OSRM_MAX_TOTAL_SECONDS", "25"))
OSRM_DISABLE = os.environ.get("OSRM_DISABLE", "false").lower() in ("1", "true", "yes")

# ------------------------------------------------------------------
# FunÃ§Ãµes de Apoio (Mantidas e Otimizadas)
# ------------------------------------------------------------------

def geocodificar_base() -> tuple:
    # 1. COORDENADAS FIXAS DA E4LOG (ITATIBA)
    # Essas sÃ£o as coordenadas reais da Rod. Alkindar Monteiro Junqueira, 30
    LAT_ESTATICA = -23.0116
    LNG_ESTATICA = -46.8125

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
                logger.info("ðŸ“ Base localizada via API.")
                return float(data[0]["lat"]), float(data[0]["lon"])
        
        # Se a API falhar ou vier vazia, usamos o PLANO B (Coordenada Fixa)
        logger.warning("âš ï¸ API de Mapas falhou. Usando localizaÃ§Ã£o fixa da E4Log.")
        return LAT_ESTATICA, LNG_ESTATICA

    except Exception as e:
        logger.error(f"Erro ao geocodificar base: {e}. Usando fallback estÃ¡tico.")
        # Se der qualquer erro (Internet, JSON, etc), retorna a fixa
        return LAT_ESTATICA, LNG_ESTATICA

def haversine_metros(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    raio = 6371000  # metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    return 2 * raio * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def build_fallback_matrix(locais: list) -> list:
    # Fallback em linha reta com fator para aproximar malha viaria.
    fator_via = 1.28
    matriz = []
    for origem in locais:
        linha = []
        for destino in locais:
            if origem["id"] == destino["id"]:
                linha.append(0)
                continue
            dist = haversine_metros(origem["lat"], origem["lng"], destino["lat"], destino["lng"])
            linha.append(int(dist * fator_via))
        matriz.append(linha)
    return matriz


def get_osrm_matrix(locais: list) -> tuple[list | None, bool]:
    if OSRM_DISABLE:
        logger.warning("[OSRM] Desabilitado por variavel de ambiente. Usando fallback local.")
        return build_fallback_matrix(locais), True

    coords = ";".join(f"{loc['lng']},{loc['lat']}" for loc in locais)
    params = {"annotations": "distance"}
    erros: list[str] = []
    inicio = time.time()

    for endpoint in OSRM_TABLE_ENDPOINTS:
        url = f"{endpoint}/{coords}"
        for tentativa in range(1, OSRM_MAX_ATTEMPTS + 1):
            if time.time() - inicio > OSRM_MAX_TOTAL_SECONDS:
                logger.warning("[OSRM] Tempo maximo total excedido. Acionando fallback.")
                logger.warning("Usando fallback por distancia em linha reta para nao travar a roteirizacao.")
                return build_fallback_matrix(locais), True
            try:
                logger.info(f"[OSRM] Tentando matriz em {endpoint} (tentativa {tentativa}/{OSRM_MAX_ATTEMPTS})")
                resposta = requests.get(url, params=params, timeout=(OSRM_CONNECT_TIMEOUT, OSRM_READ_TIMEOUT))
                resposta.raise_for_status()
                payload = resposta.json()

                if payload.get("code") == "Ok" and payload.get("distances"):
                    logger.info(f"[OSRM] Matriz recebida com sucesso via {endpoint}.")
                    return payload["distances"], False

                msg = payload.get("message", "resposta sem matriz")
                erros.append(f"{endpoint} tentativa {tentativa}: {msg}")
                logger.warning(f"[OSRM] Resposta invalida: {msg}")
            except Exception as e:
                erros.append(f"{endpoint} tentativa {tentativa}: {e}")
                logger.warning(f"[OSRM] Falha na tentativa {tentativa} em {endpoint}: {e}")

            time.sleep(min(0.8 * tentativa, 2.0))

    logger.error(f"OSRM indisponivel apos retries. Erros: {' | '.join(erros)}")
    logger.warning("Usando fallback por distancia em linha reta para nao travar a roteirizacao.")
    return build_fallback_matrix(locais), True


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
        
        logger.info(f"ðŸ’° FINANCEIRO: {km_total:.2f} km | R$ {custo:.2f} diesel")
    except Exception as e:
        logger.warning(f"Erro no cÃ¡lculo financeiro: {e}")

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
# LÃ³gica Principal de OtimizaÃ§Ã£o
# ------------------------------------------------------------------

def processar_viagem_especifica(viagem_id):
    """Executa a roteirizaÃ§Ã£o para uma viagem especÃ­fica disparada pela API"""
    try:
        # --- INÃCIO DA PARTE INSERIDA (PROTEÃ‡ÃƒO DA BASE) ---
        try:
            lat_base, lng_base = geocodificar_base()
            if not lat_base:
                raise ValueError("ServiÃ§o de mapas nÃ£o retornou a base")
        except Exception as e:
            logger.error(f"âš ï¸ Alerta: Erro ao geocodificar base da E4log: {e}")
            # Usando coordenadas padrÃ£o de Itatiba/SP para o sistema nÃ£o travar
            # Assim a viagem segue e vocÃª consegue ver o erro no log depois
            lat_base, lng_base = -23.00, -46.84 
            logger.info("ðŸ“ Usando coordenada padrÃ£o de Itatiba para evitar travamento.")
        # --- FIM DA PARTE INSERIDA ---

        # Busca dados da viagem
        viagem = supabase.table("viagens").select("*").eq("id", viagem_id).single().execute().data
        if not viagem: 
            logger.error(f"âŒ Viagem {viagem_id} nÃ£o encontrada no banco.")
            return

        # Busca entregas
        entregas = supabase.table("entregas").select("id, cliente_nome, numero_nf, lat, lng, cep, endereco_texto") \
            .eq("viagem_id", viagem_id).execute().data

        if not entregas: 
            logger.warning(f"âš ï¸ Viagem {viagem_id} nÃ£o possui entregas vinculadas.")
            return

        entregas_geo = resolver_geocodificacao(entregas)
        locais = [{"lat": lat_base, "lng": lng_base, "ids": ["BASE"]}]

        # Agrupa entregas com mesmo endereco (mesmas coordenadas) numa unica parada
        grupos: dict = {}
        for e in entregas_geo:
            if e.get("lat") and e.get("lng"):
                chave = (round(float(e["lat"]), 5), round(float(e["lng"]), 5))
                if chave not in grupos:
                    grupos[chave] = []
                grupos[chave].append(e)

        for (lat, lng), grupo in grupos.items():
            locais.append({
                "lat": lat,
                "lng": lng,
                "ids": [e["id"] for e in grupo],
                "nf": grupo[0].get("numero_nf"),
                "nome": grupo[0].get("cliente_nome")
            })

        if len(locais) <= 1: 
            logger.error("âŒ Nenhum local vÃ¡lido para roteirizar apÃ³s geocodificaÃ§Ã£o.")
            return

        matriz, usou_fallback = get_osrm_matrix(locais)
        if not matriz: 
            logger.error("âŒ Erro ao obter matriz de distÃ¢ncia do OSRM.")
            return

        # ... (Restante do cÃ³digo do OR-Tools continua igual)
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
            logger.error("âŒ Otimizador OR-Tools nÃ£o encontrou uma soluÃ§Ã£o.")
            return

        # Coleta sequencia da rota e calcula distancia total (Base -> entregas -> Base)
        distancia_total_metros = 0
        rota_sequencia = []
        index = routing.Start(0)
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            next_node = 0 if routing.IsEnd(next_index) else manager.IndexToNode(next_index)
            distancia_total_metros += matriz[node][next_node]
            if node != 0:
                rota_sequencia.append(locais[node])
            index = next_index

        # Inverte a sequencia se a primeira parada for mais longe que a ultima:
        # caminhao vai descarregando no trecho longo -> menos combustivel
        if len(rota_sequencia) >= 2:
            dist_primeira = haversine_metros(lat_base, lng_base, rota_sequencia[0]["lat"], rota_sequencia[0]["lng"])
            dist_ultima = haversine_metros(lat_base, lng_base, rota_sequencia[-1]["lat"], rota_sequencia[-1]["lng"])
            if dist_primeira > dist_ultima:
                rota_sequencia.reverse()
                logger.info("Rota invertida: entrega perto primeiro, longe por ultimo.")

        for ordem, local in enumerate(rota_sequencia, start=1):
            for id_entrega in local["ids"]:
                supabase.table("entregas").update({
                    "ordem_entrega": ordem,
                    "status_entrega": "roteirizado",
                }).eq("id", id_entrega).execute()

        # FinalizaÃ§Ã£o
        if usou_fallback:
            supabase.table("viagens").update({
                "km_total_estimado": None,
                "custo_diesel_estimado": None
            }).eq("id", viagem_id).execute()
            logger.warning("Financeiro nao calculado: matriz aproximada por fallback.")
        else:
            calcular_financeiro(viagem_id, distancia_total_metros)
        supabase.table("viagens").update({"status": "roteirizado"}).eq("id", viagem_id).execute()
        logger.info(f"ðŸ’¾ Viagem {viagem_id} finalizada com sucesso.")

    except Exception as e:
        logger.error(f"âŒ Erro crÃ­tico no processar_viagem_especifica {viagem_id}: {e}")

# ------------------------------------------------------------------
# Servidor de ProduÃ§Ã£o (Flask)
# ------------------------------------------------------------------

app = Flask(__name__)
CORS(app)

@app.route('/api/roteirizar', methods=['POST'])
def acionar_roteirizador():
    dados = request.get_json()
    viagem_id = dados.get('viagem_id')

    if not viagem_id:
        return jsonify({"status": "erro", "mensage": "viagem_id ausente"}), 400

    logger.info(f"ðŸš€ Gatilho recebido para a viagem: {viagem_id}")

    # A MÃGICA: Dispara o cÃ¡lculo em uma thread separada e LIBERA o Flask na hora
    thread = threading.Thread(target=processar_viagem_especifica, args=(viagem_id,))
    thread.start()

    # Retorna o OK imediatamente para o Postman/Site nÃ£o travarem
    return jsonify({
        "status": "sucesso", 
        "mensagem": "RoteirizaÃ§Ã£o iniciada em segundo plano. Verifique a Torre em instantes."
    }), 200

if __name__ == "__main__":
    logger.info("ðŸŸ¢ Motor Logibot Ligado (Porta 5000)")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)

