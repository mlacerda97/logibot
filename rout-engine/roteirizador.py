import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

# 1. Configuração do Ambiente
load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Ponto de partida fixo da E4log
ENDERECO_BASE = "Rodovia Alkindar Monteiro Junqueira, Itatiba, SP"

def geocodificar(endereco: str):
    """Transforma endereço em coordenadas via Nominatim (Grátis)"""
    api_url = "https://nominatim.openstreetmap.org/search"
    params = {'q': endereco, 'format': 'json', 'limit': 1}
    headers = {'User-Agent': 'Logibot_Finance_Engine/1.0'}
    try:
        res = requests.get(api_url, params=params, headers=headers)
        if res.status_code == 200 and len(res.json()) > 0:
            return float(res.json()[0]['lat']), float(res.json()[0]['lon'])
    except Exception as e:
        print(f"❌ Erro na geocodificação: {e}")
    return None, None

def get_osrm_matrix(locais):
    """Busca a matriz de distância real por ruas via OSRM (100% Grátis)"""
    # OSRM usa o formato: longitude,latitude;longitude,latitude...
    coords = ";".join([f"{loc['lng']},{loc['lat']}" for loc in locais])
    url = f"http://router.project-osrm.org/table/v1/driving/{coords}?annotations=distance"
    
    try:
        res = requests.get(url).json()
        if res.get('code') == 'Ok':
            # Retorna matriz em metros
            return res['distances']
        else:
            print("❌ Erro na resposta do OSRM")
            return None
    except Exception as e:
        print(f"❌ Erro de conexão com OSRM: {e}")
        return None

def calcular_financeiro_viagem(viagem_id, metros_totais):
    """Pilar 4: Inteligência Financeira (Rentabilidade Real)"""
    km_total = metros_totais / 1000
    
    # Busca dados da viagem e o consumo médio do veículo associado
    try:
        # Usamos join no Supabase para pegar o consumo do veículo cadastrado por você
        res = supabase.table("viagens").select("*, veiculos(consumo_medio)").eq("id", viagem_id).single().execute()
        dados = res.data
        
        # Se não houver consumo cadastrado no caminhão, usa 2.5 km/l como base
        consumo_medio = dados.get('veiculos', {}).get('consumo_medio') or 2.5
        preco_diesel = 6.00 # Este valor pode ser uma variável global ou vir de uma tabela de config
        
        # Lógica Financeira do MBA
        litros_gastos = km_total / consumo_medio
        custo_combustivel = litros_gastos * preco_diesel
        
        # Atualiza a viagem com os indicadores financeiros
        supabase.table("viagens").update({
            "km_total_estimado": round(km_total, 2),
            "custo_diesel_estimado": round(custo_combustivel, 2)
        }).eq("id", viagem_id).execute()
        
        print(f"   💰 FINANCEIRO: Distância Real: {km_total:.2f}km | Custo Diesel: R$ {custo_combustivel:.2f}")
    except Exception as e:
        print(f"⚠️ Erro no cálculo financeiro: {e}")

def otimizar_viagens():
    print("🚛 Iniciando Motor Logibot (Modo Financeiro OSRM)...\n")
    
    # 1. Pega Coordenadas da Base
    lat_base, lng_base = geocodificar(ENDERECO_BASE)
    if not lat_base:
        print("❌ Erro ao achar a Base E4log.")
        return
        
    # 2. Busca Viagens pendentes
    res_viagens = supabase.table("viagens").select("*").eq("status", "em_montagem").execute()
    viagens = res_viagens.data
    
    if not viagens:
        print("✅ Nenhuma viagem pendente de roteirização.")
        return
        
    for viagem in viagens:
        print(f"⚙️ Calculando Rota para a Viagem ID: {viagem['id']}")
        
        # 3. Busca notas fiscais (entregas) desta viagem
        res_entregas = supabase.table("entregas").select("*").eq("viagem_id", viagem["id"]).execute()
        entregas = res_entregas.data
        
        if not entregas:
            continue
            
        # 4. Lista de locais (Base é o Index 0)
        locais = [{"lat": lat_base, "lng": lng_base, "id": "BASE"}]
        for e in entregas:
            if e.get("lat"):
                locais.append({"lat": e["lat"], "lng": e["lng"], "id": e["id"], "nf": e["numero_nf"], "nome": e["cliente_nome"]})
        
        num_locais = len(locais)
        if num_locais <= 1: continue

        # 5. Busca Matriz de Distância REAL (OSRM)
        matriz_distancias = get_osrm_matrix(locais)
        if not matriz_distancias: continue

        # 6. Google OR-Tools (Otimização)
        manager = pywrapcp.RoutingIndexManager(num_locais, 1, 0)
        routing = pywrapcp.RoutingModel(manager)
        
        def distance_callback(from_index, to_index):
            return int(matriz_distancias[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)])
            
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        
        solution = routing.SolveWithParameters(search_parameters)
        
        if solution:
            print("   ✅ Rota Otimizada!")
            # Soma a distância total da rota em metros
            distancia_total_metros = solution.ObjectiveValue()
            
            index = routing.Start(0)
            ordem = 1
            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                if node_index != 0: 
                    local = locais[node_index]
                    supabase.table("entregas").update({
                        "ordem_entrega": ordem,
                        "status_entrega": "roteirizado"
                    }).eq("id", local["id"]).execute()
                    ordem += 1
                index = solution.Value(routing.NextVar(index))
            
            # --- INTEGRAÇÃO FINANCEIRA ---
            calcular_financeiro_viagem(viagem['id'], distancia_total_metros)
            
            # Finaliza Status
            supabase.table("viagens").update({"status": "roteirizado"}).eq("id", viagem["id"]).execute()
            print("   💾 Viagem Roteirizada e Financeiro Calculado!\n")
        else:
            print("   ❌ Falha ao encontrar rota.")

if __name__ == "__main__":
    otimizar_viagens()