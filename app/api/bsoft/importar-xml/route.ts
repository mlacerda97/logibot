import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BSOFT_API_URL = "https://api.bsoft.com.br/sistema/v2";
export const runtime = "nodejs";

const extrairTag = (conteudo: string, tag: string) =>
  conteudo.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1]?.trim() || "";

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { id_bsoft, numero_cte, token } = await req.json();

    const xmlReq = await fetch(`${BSOFT_API_URL}/cte/${id_bsoft}/xml`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
      signal: AbortSignal.timeout(30000)
    });

    if (!xmlReq.ok) throw new Error("Erro ao baixar XML");
    const xmlString = await xmlReq.text();

    const nfeMatches = [...xmlString.matchAll(/<chave>(.*?)<\/chave>/g)];
    const chavesNFe = nfeMatches.map((m) => {
      const chaveCompleta = m[1].trim();
      if (chaveCompleta.length === 44) return String(parseInt(chaveCompleta.substring(25, 34), 10));
      return chaveCompleta;
    });
    if (chavesNFe.length === 0) chavesNFe.push(`CTE-${numero_cte}`);

    const dhEmi = extrairTag(xmlString, "dhEmi");
    const dataEmissaoCte = dhEmi ? dhEmi.slice(0, 10) : "";
    const municipioEntrega = extrairTag(xmlString, "xMunFim");
    const ufEntrega = extrairTag(xmlString, "UFFim");

    const infNfeMatches = [...xmlString.matchAll(/<infNFe>([\s\S]*?)<\/infNFe>/g)];
    const dataPrevPorNf = new Map<string, string>();
    let dPrevFallback = "";
    infNfeMatches.forEach((match) => {
      const bloco = match[1];
      const chave = extrairTag(bloco, "chave");
      const dPrev = extrairTag(bloco, "dPrev");
      if (!dPrev) return;
      if (!dPrevFallback) dPrevFallback = dPrev;
      if (chave) {
        const nfDaChave = chave.length === 44 ? String(parseInt(chave.substring(25, 34), 10)) : chave;
        dataPrevPorNf.set(nfDaChave, dPrev);
      }
    });

    let cliente_nome = "Nao identificado";
    let endereco_texto = "Endereco nao informado";
    let cep = "";
    let enderHtml = "";

    const destSection = xmlString.match(/<dest>([\s\S]*?)<\/dest>/);
    const recebSection = xmlString.match(/<receb>([\s\S]*?)<\/receb>/);

    if (destSection) {
      const d = destSection[1];
      cliente_nome = d.match(/<xNome>(.*?)<\/xNome>/)?.[1] || cliente_nome;
      enderHtml = d.match(/<enderDest>([\s\S]*?)<\/enderDest>/)?.[1] || "";
    }

    if (recebSection) {
      const r = recebSection[1];
      cliente_nome = r.match(/<xNome>(.*?)<\/xNome>/)?.[1] || cliente_nome;
      enderHtml = r.match(/<enderReceb>([\s\S]*?)<\/enderReceb>/)?.[1] || enderHtml;
    }

    if (enderHtml) {
      const lgr = enderHtml.match(/<xLgr>(.*?)<\/xLgr>/)?.[1] || "";
      const nro = enderHtml.match(/<nro>(.*?)<\/nro>/)?.[1] || "S/N";
      const bairro = enderHtml.match(/<xBairro>(.*?)<\/xBairro>/)?.[1] || "";
      const munEndereco = enderHtml.match(/<xMun>(.*?)<\/xMun>/)?.[1] || "";
      const ufEndereco = enderHtml.match(/<UF>(.*?)<\/UF>/)?.[1] || "";
      const cepRaw = enderHtml.match(/<CEP>(.*?)<\/CEP>/)?.[1] || "";
      cep = cepRaw ? cepRaw.replace(/\D/g, "").padStart(8, "0") : "";
      endereco_texto = `${lgr}, ${nro} - ${bairro}, ${munEndereco}/${ufEndereco}`;
    }

    let inseridas = 0;
    for (const nf of chavesNFe) {
      const { data: existente } = await supabase
        .from("entregas")
        .select("id")
        .eq("cte_origem", String(numero_cte))
        .eq("numero_nf", nf)
        .maybeSingle();

      if (!existente) {
        const dataPrevistaEntrega = dataPrevPorNf.get(nf) || dPrevFallback || null;
        const payloadBase = {
          cte_origem: String(numero_cte),
          numero_nf: nf,
          cliente_nome,
          endereco_texto,
          cep: cep || null,
          status_entrega: "aguardando_roteirizacao"
        };

        const payloadComMetadados = {
          ...payloadBase,
          municipio_entrega: municipioEntrega || null,
          uf_entrega: ufEntrega || null,
          data_prevista_entrega: dataPrevistaEntrega,
          data_emissao_cte: dataEmissaoCte || null
        };

        let { error: insertError } = await supabase.from("entregas").insert([payloadComMetadados]);

        if (insertError && /municipio_entrega|uf_entrega|data_prevista_entrega|data_emissao_cte/i.test(insertError.message || "")) {
          const retry = await supabase.from("entregas").insert([payloadBase]);
          insertError = retry.error;
        }

        if (!insertError) inseridas += 1;
      }
    }

    return NextResponse.json({ success: true, cte: numero_cte, inseridas }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
