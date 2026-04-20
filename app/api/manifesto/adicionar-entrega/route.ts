import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const viagemId = String(body?.viagem_id || "").trim();
    const entregaId = String(body?.entrega_id || "").trim();

    if (!viagemId || !entregaId) {
      return NextResponse.json({ error: "viagem_id e entrega_id sao obrigatorios." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("entregas")
      .update({
        viagem_id: viagemId,
        ordem_entrega: null,
        status_entrega: "aguardando_roteirizacao"
      })
      .eq("id", entregaId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
