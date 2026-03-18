import { NextResponse } from "next/server";

export async function GET(request: Request) {
    // 1. SEGURANÇA: Garante que apenas o seu servidor autorizado pode disparar esse robô
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Acesso Negado. Apenas o Robô do Logibot pode rodar isso.', { status: 401 });
    }

    try {
        console.log("🤖 [CRON] Iniciando varredura automática na Bsoft...");

        // 2. Define a janela de tempo (Hoje e Ontem para garantir)
        const hoje = new Date();
        const ontem = new Date();
        ontem.setDate(hoje.getDate() - 1);
        
        // Formata para o padrão que a Bsoft aceita (DD/MM/YYYY)
        const formatar = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const dataInicial = formatar(ontem);
        const dataFinal = formatar(hoje);

        // 3. Pega a URL base do seu sistema (localhost ou o site oficial na nuvem)
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

        // 4. CHAMA A SUA PRÓPRIA API DE LISTAGEM (O mesmo que a tela faz)
        const resListar = await fetch(`${baseUrl}/api/bsoft/listar-lote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                data_inicial: dataInicial, 
                data_final: dataFinal,
                numero_cte: "" 
            }),
        });

        const dataListar = await resListar.json();
        
        if (!dataListar.ctes || dataListar.ctes.length === 0) {
            console.log("🤖 [CRON] Varredura concluída: Nenhum CT-e novo.");
            return NextResponse.json({ message: "Nenhum CT-e novo para importar." });
        }

        console.log(`🤖 [CRON] Encontrados ${dataListar.ctes.length} CT-es pendentes. Iniciando importação...`);

        // 5. IMPORTA CADA NOTA SILENCIOSAMENTE
        let importados = 0;
        for (const cte of dataListar.ctes) {
            try {
                await fetch(`${baseUrl}/api/bsoft/importar-xml`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        id_bsoft: cte.id, 
                        numero_cte: cte.numero, 
                        token: dataListar.token 
                    }),
                });
                importados++;
            } catch (err) {
                console.error(`🤖 [CRON] Falha ao importar CT-e ${cte.numero}`);
            }
        }

        console.log(`🤖 [CRON] Sucesso! ${importados} CT-es enviados para a Triagem.`);
        return NextResponse.json({ message: `Sincronização automática concluída. ${importados} importados.` });

    } catch (error: any) {
        console.error("🤖 [CRON] Erro Crítico:", error.message);
        return NextResponse.json({ error: "Erro interno no Cron Job" }, { status: 500 });
    }
}