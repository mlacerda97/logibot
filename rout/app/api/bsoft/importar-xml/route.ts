import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const BSOFT_API_URL = 'https://api.bsoft.com.br/sistema/v2';

export async function POST(req: Request) {
  try {
    const { id_bsoft, numero_cte, token } = await req.json();

    // 1. BAIXA O XML DIRETO (Super rápido porque já temos o ID e o Token)
    const xmlReq = await fetch(`${BSOFT_API_URL}/cte/${id_bsoft}/xml`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/xml' }
    });

    if (!xmlReq.ok) throw new Error("Erro ao baixar XML");
    const xmlString = await xmlReq.text();

    // 2. EXTRAI NOTAS
    const nfeMatches = [...xmlString.matchAll(/<chave>(.*?)<\/chave>/g)];
    const chavesNFe = nfeMatches.map(m => {
      const chaveCompleta = m[1];
      if (chaveCompleta.length === 44) return String(parseInt(chaveCompleta.substring(25, 34), 10));
      return chaveCompleta; 
    });
    if (chavesNFe.length === 0) chavesNFe.push(`CTE-${numero_cte}`);

    // 3. INTELIGÊNCIA DE ENDEREÇO (Destinatário vs Recebedor)
    let recebedor_nome = 'Não identificado';
    let enderecoCompleto = 'Endereço não informado';
    let enderHtml = '';

    // No CT-e, se tiver a tag <receb> (Recebedor), ela é o local físico real da entrega!
    const recebSection = xmlString.match(/<receb>([\s\S]*?)<\/receb>/);
    const destSection = xmlString.match(/<dest>([\s\S]*?)<\/dest>/);

    // Começa pelo Destinatário Padrão
    if (destSection) {
      const destHtml = destSection[1];
      recebedor_nome = destHtml.match(/<xNome>(.*?)<\/xNome>/)?.[1] || recebedor_nome;
      enderHtml = destHtml.match(/<enderDest>([\s\S]*?)<\/enderDest>/)?.[1] || '';
    }

    // SOBRESCREVE pelo RECEBEDOR se existir (Isso resolve o problema do endereço diferente!)
    if (recebSection) {
      const recHtml = recebSection[1];
      recebedor_nome = recHtml.match(/<xNome>(.*?)<\/xNome>/)?.[1] || recebedor_nome;
      enderHtml = recHtml.match(/<enderReceb>([\s\S]*?)<\/enderReceb>/)?.[1] || enderHtml;
    }

    if (enderHtml) {
      const lgr = enderHtml.match(/<xLgr>(.*?)<\/xLgr>/)?.[1] || '';
      const nro = enderHtml.match(/<nro>(.*?)<\/nro>/)?.[1] || 'S/N';
      const bairro = enderHtml.match(/<xBairro>(.*?)<\/xBairro>/)?.[1] || '';
      const mun = enderHtml.match(/<xMun>(.*?)<\/xMun>/)?.[1] || '';
      const uf = enderHtml.match(/<UF>(.*?)<\/UF>/)?.[1] || '';
      enderecoCompleto = `${lgr}, ${nro} - ${bairro}, ${mun}/${uf}`;
    }

    // 4. SALVA NO SUPABASE (COM PROTEÇÃO ANTI-DUPLICIDADE)
    const notasParaInserir = chavesNFe.map(nf => ({
      cte_origem: String(numero_cte),
      numero_nf: nf,
      cliente_nome: recebedor_nome,
      endereco_texto: enderecoCompleto,
      status_entrega: 'pendente_confirmacao'
    }));

    let inseridas = 0;
    for (const nota of notasParaInserir) {
      // Verifica se a NF deste CTe já existe no banco
      const { data: existente } = await supabase
        .from('entregas')
        .select('id')
        .eq('cte_origem', nota.cte_origem)
        .eq('numero_nf', nota.numero_nf)
        .single();

      // Só insere se não existir (evita que a tela das meninas fique com lixo duplicado)
      if (!existente) {
        await supabase.from('entregas').insert([nota]);
        inseridas++;
      }
    }

    return NextResponse.json({ success: true, cte: numero_cte, inseridas }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}