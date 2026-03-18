import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; 

const BSOFT_API_URL = 'https://api.bsoft.com.br/sistema/v2';

export async function POST(req: Request) {
  try {
    const { data_inicial, data_final, numero_cte } = await req.json();

    // ARRAY COM AS DUAS EMPRESAS DA E4LOG
    const empresas = [1, 2]; 
    let todosCtesBsoft: any[] = [];

    // LOOP DE BUSCA NAS DUAS EMPRESAS
    for (const idEmpresa of empresas) {
      const loginPayload = {
        tag: process.env.BSOFT_TAG,
        id_bsoft: process.env.BSOFT_TAG, 
        usuario_sistema: process.env.BSOFT_USUARIO,
        senha_sistema: process.env.BSOFT_SENHA,
        empresa: idEmpresa // <--- Alterna dinamicamente entre 1 e 2
      };

      const loginReq = await fetch(`${BSOFT_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });

      if (loginReq.ok) {
        const loginData = await loginReq.json();
        const token = loginData.token || loginData.access_token;

        let urlBusca = `${BSOFT_API_URL}/cte?data_inicial=${data_inicial}&data_final=${data_final}`;
        if (numero_cte) urlBusca += `&numero=${numero_cte}`;

        const cteReq = await fetch(urlBusca, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (cteReq.ok) {
          const ctes = await cteReq.json();
          // MÁGICA: Injetamos o token correto DENTRO de cada CT-e, para o importar-xml saber qual usar depois
          const ctesComToken = ctes.map((c: any) => ({ ...c, token_valido: token, empresa_origem: idEmpresa }));
          todosCtesBsoft = [...todosCtesBsoft, ...ctesComToken];
        }
      } else {
        console.warn(`Aviso: Falha ao logar na Empresa ${idEmpresa} da Bsoft.`);
      }
    }

    // A partir daqui, a lógica é a mesma, mas usando 'todosCtesBsoft' que tem os CT-es da matriz e da filial
    let ctesFiltrados = todosCtesBsoft;
    if (numero_cte) {
        ctesFiltrados = todosCtesBsoft.filter((c: any) => String(c.numero) === String(numero_cte));
    }

    const numerosBsoft = ctesFiltrados.map((c: any) => String(c.numero));
    let numerosExistentes = new Set();

    if (numerosBsoft.length > 0) {
        const { data: ctesNoBanco } = await supabase
            .from('entregas')
            .select('cte_origem')
            .in('cte_origem', numerosBsoft);
            
        if (ctesNoBanco) {
            ctesNoBanco.forEach(c => numerosExistentes.add(c.cte_origem));
        }
    }

    const ctesIneditos = ctesFiltrados.filter((c: any) => !numerosExistentes.has(String(c.numero)));

    const ctesMapeados = ctesIneditos.map((c: any) => ({
      id: c.id,
      numero: String(c.numero),
      token: c.token_valido // <--- Entrega o token embutido no CT-e
    }));
    
    const jaImportado = numero_cte && ctesFiltrados.length > 0 && ctesIneditos.length === 0;

    return NextResponse.json({ 
        ctes: ctesMapeados, 
        ja_importado: jaImportado
    }, { status: 200 });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}