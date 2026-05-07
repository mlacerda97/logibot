import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const viagemId = String(body?.viagem_id || "").trim();

    if (!viagemId) {
      return NextResponse.json({ error: "viagem_id e obrigatorio." }, { status: 400 });
    }

    const baseMotor = (
      process.env.ROTEIRIZADOR_URL ||
      process.env.NEXT_PUBLIC_ROTEIRIZADOR_URL ||
      "http://127.0.0.1:5000"
    ).replace(/\/$/, "");

    const resposta = await fetch(`${baseMotor}/api/roteirizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viagem_id: viagemId }),
      signal: AbortSignal.timeout(15000)
    });

    const payload = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      return NextResponse.json(
        { error: payload?.mensagem || payload?.message || "Falha ao acionar roteirizador." },
        { status: resposta.status }
      );
    }

    return NextResponse.json({ ok: true, payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
