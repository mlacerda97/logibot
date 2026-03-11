import os
import time
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Carrega as variáveis de ambiente
load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def geocodificar(endereco: str):
    """Bate no mapa para pegar Lat/Lng"""
    api_url = "https://nominatim.openstreetmap.org/search"
    params = {'q': endereco, 'format': 'json', 'limit': 1}
    headers = {'User-Agent': 'Logibot_Engine_E4log/1.0'}
    
    try:
        resposta = requests.get(api_url, params=params, headers=headers)
        if resposta.status_code == 200 and len(resposta.json()) > 0:
            dados = resposta.json()[0]
            return float(dados['lat']), float(dados['lon'])
    except Exception as e:
        print(f"Erro na API de mapas: {e}")
    return None, None

def processar_geocodificacao():
    print("🔍 Buscando notas 'aguardando_roteirizacao' sem coordenadas...")
    
    # Traz só quem já passou pela Triagem das meninas e não tem Lat/Lng
    resposta = supabase.table("entregas") \
        .select("*") \
        .eq("status_entrega", "aguardando_roteirizacao") \
        .is_("lat", "null") \
        .execute()
    
    entregas = resposta.data
    
    if not entregas:
        print("✅ Nenhuma nota pendente de mapa no momento.")
        return

    print(f"🗺️ Encontradas {len(entregas)} notas para mapear!\n")
    
    for entrega in entregas:
        endereco_texto = entrega['endereco_texto']
        print(f"📍 Original: {endereco_texto}")
        
        # 1. Tenta o endereço completo
        lat, lng = geocodificar(endereco_texto)
        
        # 2. PLANO B (Fallback): Se não achar, tenta só pela Cidade/UF
        if not lat or not lng:
            # Pega a parte final do texto formatado (ex: "Miracatu/SP")
            cidade_uf = endereco_texto.split(',')[-1].split('-')[-1].strip()
            print(f"   ⚠️ Rua não encontrada! Ativando Plano B (Tentando Centro de: {cidade_uf})...")
            lat, lng = geocodificar(cidade_uf)
        
        # 3. Salva o resultado no Banco
        if lat and lng:
            supabase.table("entregas").update({"lat": lat, "lng": lng}).eq("id", entrega["id"]).execute()
            print(f"   ✅ Salvo! Lat: {lat} | Lng: {lng}")
        else:
            print("   ❌ Erro Crítico: Não foi possível mapear nem a cidade. Endereço inválido.")
        
        print("-" * 50)
        # Regra de ouro do Nominatim: 1 segundo de pausa
        time.sleep(1)
        
    print("\n🚀 Geocodificação finalizada!")

if __name__ == "__main__":
    processar_geocodificacao()