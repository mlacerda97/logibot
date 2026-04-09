"""
geocodificador.py  —  rout-engine/geocodificador.py
----------------------------------------------------
Geocodificação em 4 camadas. Custo zero.

Camada 0 → CEP extraído do XML (salvo no banco)  — precisão: rua/porta
Camada 1 → Parse do endereco_texto + Nominatim   — precisão: rua
Camada 2 → Endereço simplificado (só rua+cidade) — precisão: rua aproximada
Camada 3 → Centróide de cidade                   — fallback
"""

import re
import time
import requests
import logging

logger = logging.getLogger(__name__)

NOMINATIM_HEADERS = {"User-Agent": "Logibot/1.0 (contato@e4log.com.br)"}
NOMINATIM_DELAY   = 1.1   # política OSM: máx 1 req/s


# ------------------------------------------------------------------
# Funções internas
# ------------------------------------------------------------------

def _nominatim_query(query: str):
    """Consulta genérica ao Nominatim. Retorna (lat, lng) ou None."""
    try:
        res = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "br"},
            headers=NOMINATIM_HEADERS,
            timeout=10,
        )
        data = res.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        logger.warning(f"Nominatim erro — query='{query}': {e}")
    return None


def _camada_cep(cep: str):
    """
    Camada 0: CEP via ViaCEP → endereço estruturado → Nominatim.
    Precisão: porta/rua. ~95% dos CT-es têm CEP válido.
    """
    cep_limpo = re.sub(r'\D', '', cep).zfill(8)
    if len(cep_limpo) != 8:
        return None
    try:
        res = requests.get(
            f"https://viacep.com.br/ws/{cep_limpo}/json/",
            timeout=5
        )
        dados = res.json()
        if dados.get("erro"):
            return None
        query = ", ".join(filter(None, [
            dados.get("logradouro"),
            dados.get("bairro"),
            dados.get("localidade"),
            dados.get("uf"),
            "Brasil",
        ]))
        time.sleep(NOMINATIM_DELAY)
        return _nominatim_query(query)
    except Exception as e:
        logger.warning(f"ViaCEP erro — CEP={cep}: {e}")
        return None


def _parse_endereco_texto(endereco_texto: str) -> dict:
    """
    Parseia string livre no formato:
    'Rua X, 123 - Bairro, Cidade/UF'
    Retorna dict com logradouro, numero, bairro, cidade, uf.
    """
    resultado = {"logradouro": "", "numero": "", "bairro": "", "cidade": "", "uf": ""}
    if not endereco_texto or endereco_texto == "Endereço não informado":
        return resultado

    # Extrai UF (2 letras no final após /)
    uf_match = re.search(r'/([A-Z]{2})$', endereco_texto.strip())
    if uf_match:
        resultado["uf"] = uf_match.group(1)

    # Separa pelo ' - ' para isolar logradouro+numero do bairro+cidade
    partes = endereco_texto.split(" - ", 1)

    # Parte 1: logradouro + numero (separados por última vírgula antes do número)
    logradouro_parte = partes[0].strip()
    num_match = re.search(r',\s*(\d+\w*)\s*$', logradouro_parte)
    if num_match:
        resultado["numero"]     = num_match.group(1)
        resultado["logradouro"] = logradouro_parte[:num_match.start()].strip()
    else:
        resultado["logradouro"] = logradouro_parte

    # Parte 2: bairro + cidade/UF
    if len(partes) > 1:
        resto = partes[1].strip()
        # Remove UF do final
        resto = re.sub(r'/[A-Z]{2}$', '', resto).strip()
        # Última vírgula separa bairro de cidade
        if ',' in resto:
            idx = resto.rfind(',')
            resultado["bairro"] = resto[:idx].strip()
            resultado["cidade"] = resto[idx+1:].strip()
        else:
            resultado["cidade"] = resto

    return resultado


def _camada_endereco_texto(endereco_texto: str):
    """
    Camada 1: Parseia endereco_texto e geocodifica via Nominatim.
    """
    p = _parse_endereco_texto(endereco_texto)
    if not p["logradouro"] or not p["cidade"]:
        return None

    nro = p["numero"] if p["numero"] and p["numero"].upper() not in ("SN", "S/N", "0") else ""
    query = ", ".join(filter(None, [
        p["logradouro"], nro, p["bairro"], p["cidade"], p["uf"], "Brasil"
    ]))
    time.sleep(NOMINATIM_DELAY)
    return _nominatim_query(query)


def _camada_endereco_simplificado(endereco_texto: str):
    """
    Camada 2: Tenta só logradouro + cidade (sem número/bairro).
    Útil quando o número é inválido ou bairro confunde o Nominatim.
    """
    p = _parse_endereco_texto(endereco_texto)
    if not p["logradouro"] or not p["cidade"]:
        return None

    query = ", ".join(filter(None, [
        p["logradouro"], p["cidade"], p["uf"], "Brasil"
    ]))
    time.sleep(NOMINATIM_DELAY)
    return _nominatim_query(query)


def _camada_cidade(cidade: str, uf: str):
    """Camada 3: Centróide do município — último recurso."""
    if not cidade:
        return None
    time.sleep(NOMINATIM_DELAY)
    return _nominatim_query(f"{cidade}, {uf}, Brasil")


# ------------------------------------------------------------------
# Função pública — usada pelo roteirizador
# ------------------------------------------------------------------

def geocodificar_entrega(entrega: dict) -> tuple:
    """
    Recebe um dict com os campos da tabela `entregas`.
    Retorna (lat, lng, camada) onde camada é:
        'cep' | 'endereco' | 'endereco_simples' | 'cidade' | 'falhou'
    """
    cep            = (entrega.get("cep")            or "").strip()
    endereco_texto = (entrega.get("endereco_texto") or "").strip()

    # Extrai cidade/UF do endereco_texto para fallback de cidade
    p = _parse_endereco_texto(endereco_texto)
    cidade = p.get("cidade", "")
    uf     = p.get("uf", "")

    # --- Camada 0: CEP ---
    if cep:
        logger.info(f"[GEO] Camada 0 — CEP {cep}")
        r = _camada_cep(cep)
        if r:
            return r[0], r[1], "cep"
        logger.warning(f"[GEO] CEP {cep} sem resultado. Tentando Camada 1.")

    # --- Camada 1: endereco_texto completo ---
    if endereco_texto:
        logger.info(f"[GEO] Camada 1 — {endereco_texto}")
        r = _camada_endereco_texto(endereco_texto)
        if r:
            return r[0], r[1], "endereco"
        logger.warning(f"[GEO] Endereço completo sem resultado. Tentando Camada 2.")

    # --- Camada 2: logradouro + cidade simplificado ---
    if endereco_texto:
        logger.info(f"[GEO] Camada 2 — endereço simplificado")
        r = _camada_endereco_simplificado(endereco_texto)
        if r:
            return r[0], r[1], "endereco_simples"
        logger.warning(f"[GEO] Endereço simplificado sem resultado. Tentando Camada 3.")

    # --- Camada 3: centróide de cidade ---
    if cidade:
        logger.info(f"[GEO] Camada 3 — centróide {cidade}/{uf}")
        r = _camada_cidade(cidade, uf)
        if r:
            return r[0], r[1], "cidade"

    logger.error(f"[GEO] Falhou — id={entrega.get('id')} | CEP={cep} | {endereco_texto}")
    return None, None, "falhou"