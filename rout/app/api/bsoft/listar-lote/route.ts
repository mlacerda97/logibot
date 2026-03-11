import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // <-- NOVO: Importando nosso banco!

const BSOFT_API_URL = 'https://api.bsoft.com.br/sistema/v2';

export async function POST(req: Request) {
  try {
    const { data_inicial, data_final, numero_cte } = await req.json();

    const loginPayload = {
      tag: process.env.BSOFT_TAG,
      id_bsoft: process.env.BSOFT_TAG, 
      usuario_sistema: process.env.BSOFT_USUARIO,
      senha_sistema: process.env.BSOFT_SENHA,
      empresa: Number(process.env.BSOFT_EMPRESA) || 1
    };

    const loginReq = await fetch(`${BSOFT_API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload)
    });

    if (!loginReq.ok) throw new Error("Falha na autenticação com a Bsoft.");
    const loginData = await loginReq.json();
    const token = loginData.token || loginData.access_token;

    let urlBusca = `${BSOFT_API_URL}/cte?data_inicial=${data_inicial}&data_final=${data_final}`;
    if (numero_cte) urlBusca += `&numero=${numero_cte}`;

    const cteReq = await fetch(urlBusca, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!cteReq.ok) throw new Error("Erro ao listar CT-es da Bsoft.");
    const ctes = await cteReq.json();

    let ctesFiltrados = ctes;
    if (numero_cte) {
        ctesFiltrados = ctes.filter((c: any) => String(c.numero) === String(numero_cte));
    }

    // ==========================================
    // NOVO: INTELIGÊNCIA DE CRUZAMENTO DE DADOS
    // ==========================================
    
    // 1. Pega só os números dos CT-es encontrados na Bsoft
    const numerosBsoft = ctesFiltrados.map((c: any) => String(c.numero));
    
    let numerosExistentes = new Set();

    // 2. Vai no Supabase e pergunta: "Quais desses números você já tem salvos?"
    if (numerosBsoft.length > 0) {
        const { data: ctesNoBanco } = await supabase
            .from('entregas')
            .select('cte_origem')
            .in('cte_origem', numerosBsoft); // Busca otimizada em lote no banco
            
        if (ctesNoBanco) {
            ctesNoBanco.forEach(c => numerosExistentes.add(c.cte_origem));
        }
    }

    // 3. Filtra a lista final deixando SÓ o que é novo (inédito)
    const ctesIneditos = ctesFiltrados.filter((c: any) => !numerosExistentes.has(String(c.numero)));

    const ctesMapeados = ctesIneditos.map((c: any) => ({
      id: c.id,
      numero: String(c.numero)
    }));
    
    // Mandamos uma flag extra para o Front-end saber se o CT-e foi barrado por já existir
    const jaImportado = numero_cte && ctesFiltrados.length > 0 && ctesIneditos.length === 0;

    return NextResponse.json({ 
        ctes: ctesMapeados, 
        token,
        ja_importado: jaImportado
    }, { status: 200 });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}