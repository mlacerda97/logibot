import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entregaId = String(body?.entregaId || "").trim();

    if (!entregaId) {
      return NextResponse.json({ error: "entregaId e obrigatorio." }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { error } = await admin
      .from("entregas")
      .update({
        viagem_id: null,
        ordem_entrega: null,
        status_entrega: "aguardando_roteirizacao"
      })
      .eq("id", entregaId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
