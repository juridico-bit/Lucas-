export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { reescreverCompromisso } from "@/lib/reescrever";
import { enqueueAI } from "@/lib/ai-queue";

export async function POST(request: NextRequest) {
  try {
    const { texto } = (await request.json()) as { texto?: string };
    if (!texto?.trim()) {
      return NextResponse.json({ error: "Texto vazio" }, { status: 400 });
    }
    const reescrito = await enqueueAI(() => reescreverCompromisso(texto), "reescrever-compromisso-manual");
    return NextResponse.json({ reescrito });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
