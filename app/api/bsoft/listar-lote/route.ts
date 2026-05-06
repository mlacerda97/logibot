import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BSOFT_API_URL = "https://api.bsoft.com.br/sistema/v2";
export const runtime = "nodejs";

type BsoftCte = {
  id: string | number;
  numero: string | number;
  token_valido: string;
};

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data_inicial, data_final, numero_cte, numeros_cte } = await req.json();

    // Normaliza para array de números
    const numerosArray: string[] = numeros_cte
      ? (Array.isArray(numeros_cte) ? numeros_cte : [numeros_cte]).map(String).filter(Boolean)
      : numero_cte ? [String(numero_cte)] : [];

    const empresas = [1, 2];
    const todosCtesBsoft: BsoftCte[] = [];

    for (const idEmpresa of empresas) {
      try {
        const loginPayload = {
          tag: process.env.BSOFT_TAG,
          id_bsoft: process.env.BSOFT_TAG,
          usuario_sistema: process.env.BSOFT_USUARIO,
          senha_sistema: process.env.BSOFT_SENHA,
          empresa: idEmpresa
        };

        const loginReq = await fetch(`${BSOFT_API_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loginPayload),
          signal: AbortSignal.timeout(15000)
        });

        if (!loginReq.ok) continue;

        const loginData = await loginReq.json();
        const token = loginData.token || loginData.access_token;
        if (!token) continue;

        let urlBusca = `${BSOFT_API_URL}/cte?data_inicial=${data_inicial}&data_final=${data_final}`;
        // Para busca de número único, filtra direto na API; para múltiplos, traz tudo e filtra local
        if (numerosArray.length === 1) urlBusca += `&numero=${numerosArray[0]}`;

        const cteReq = await fetch(urlBusca, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(30000)
        });

        if (!cteReq.ok) continue;

        const ctes = (await cteReq.json()) as Array<{ id: string | number; numero: string | number }>;
        todosCtesBsoft.push(
          ...ctes.map((c) => ({
            id: c.id,
            numero: c.numero,
            token_valido: token
          }))
        );
      } catch (erroEmpresa) {
        console.warn(`Falha ao consultar empresa ${idEmpresa}`, erroEmpresa);
      }
    }

    const ctesFiltrados = numerosArray.length > 0
      ? todosCtesBsoft.filter((c) => numerosArray.includes(String(c.numero)))
      : todosCtesBsoft;

    const numerosBsoft = ctesFiltrados.map((c) => String(c.numero));
    const numerosExistentes = new Set<string>();

    if (numerosBsoft.length > 0) {
      const { data: ctesNoBanco } = await supabase
        .from("entregas")
        .select("cte_origem")
        .in("cte_origem", numerosBsoft);

      (ctesNoBanco || []).forEach((c: { cte_origem: string }) => numerosExistentes.add(String(c.cte_origem)));
    }

    const ctesIneditos = ctesFiltrados.filter((c) => !numerosExistentes.has(String(c.numero)));
    const ctesMapeados = ctesIneditos.map((c) => ({
      id: c.id,
      numero: String(c.numero),
      token: c.token_valido
    }));

    const jaImportado = Boolean(numerosArray.length === 1 && ctesFiltrados.length > 0 && ctesIneditos.length === 0);
    return NextResponse.json({ ctes: ctesMapeados, ja_importado: jaImportado }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
