import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const BSOFT_API_URL = 'https://api.bsoft.com.br/sistema/v2';

export async function POST(req: Request) {
  try {
    const { id_bsoft, numero_cte, token } = await req.json();

    // 1. BAIXA O XML
    const xmlReq = await fetch(`${BSOFT_API_URL}/cte/${id_bsoft}/xml`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/xml' }
    });

    if (!xmlReq.ok) throw new Error("Erro ao baixar XML");
    const xmlString = await xmlReq.text();

    // 2. EXTRAI NOTAS FISCAIS
    const nfeMatches = [...xmlString.matchAll(/<chave>(.*?)<\/chave>/g)];
    const chavesNFe = nfeMatches.map(m => {
      const chaveCompleta = m[1];
      if (chaveCompleta.length === 44) return String(parseInt(chaveCompleta.substring(25, 34), 10));
      return chaveCompleta;
    });
    if (chavesNFe.length === 0) chavesNFe.push(`CTE-${numero_cte}`);

    // 3. EXTRAI DADOS DO DESTINATÁRIO / RECEBEDOR
    let cliente_nome = 'Não identificado';
    let endereco_texto = 'Endereço não informado';
    let cep = '';
    let enderHtml = '';

    const destSection = xmlString.match(/<dest>([\s\S]*?)<\/dest>/);
    const recebSection = xmlString.match(/<receb>([\s\S]*?)<\/receb>/);

    if (destSection) {
      const d = destSection[1];
      cliente_nome = d.match(/<xNome>(.*?)<\/xNome>/)?.[1] || cliente_nome;
      enderHtml = d.match(/<enderDest>([\s\S]*?)<\/enderDest>/)?.[1] || '';
    }

    // Recebedor sobrescreve destinatário (local físico real da entrega)
    if (recebSection) {
      const r = recebSection[1];
      cliente_nome = r.match(/<xNome>(.*?)<\/xNome>/)?.[1] || cliente_nome;
      enderHtml = r.match(/<enderReceb>([\s\S]*?)<\/enderReceb>/)?.[1] || enderHtml;
    }

    if (enderHtml) {
      const lgr    = enderHtml.match(/<xLgr>(.*?)<\/xLgr>/)?.[1]     || '';
      const nro    = enderHtml.match(/<nro>(.*?)<\/nro>/)?.[1]        || 'S/N';
      const bairro = enderHtml.match(/<xBairro>(.*?)<\/xBairro>/)?.[1] || '';
      const mun    = enderHtml.match(/<xMun>(.*?)<\/xMun>/)?.[1]       || '';
      const uf     = enderHtml.match(/<UF>(.*?)<\/UF>/)?.[1]          || '';
      const cepRaw = enderHtml.match(/<CEP>(.*?)<\/CEP>/)?.[1]        || '';

      // CEP: remove tudo que não é dígito e garante 8 chars
      if (cepRaw) {
        cep = cepRaw.replace(/\D/g, '').padStart(8, '0');
      }

      endereco_texto = `${lgr}, ${nro} - ${bairro}, ${mun}/${uf}`;
    }

    // 4. SALVA NO SUPABASE COM PROTEÇÃO ANTI-DUPLICIDADE
    let inseridas = 0;
    for (const nf of chavesNFe) {
      const { data: existente } = await supabase
        .from('entregas')
        .select('id')
        .eq('cte_origem', String(numero_cte))
        .eq('numero_nf', nf)
        .single();

      if (!existente) {
        const { error: insertError } = await supabase
          .from('entregas')
          .insert([{
            cte_origem:     String(numero_cte),
            numero_nf:      nf,
            cliente_nome:   cliente_nome,
            endereco_texto: endereco_texto,
            cep:            cep || null,
            // ===============================================
            // MÁGICA AQUI: O STATUS JÁ VAI DIRETO PRO ROMANEIO
            // ===============================================
            status_entrega: 'aguardando_roteirizacao', 
          }]);

        if (insertError) {
          console.error('ERRO INSERT CT-e', numero_cte, ':', insertError.message);
        } else {
          inseridas++;
        }
      }
    }

    return NextResponse.json({ success: true, cte: numero_cte, inseridas }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}