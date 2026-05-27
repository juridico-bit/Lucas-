import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { HistoricoItem } from "@/lib/types";

const HISTORICO_PATH = path.join(process.cwd(), "data", "historico.json");
const MAX_ITENS = 100;

function lerHistorico(): HistoricoItem[] {
  try {
    if (!fs.existsSync(HISTORICO_PATH)) return [];
    const raw = fs.readFileSync(HISTORICO_PATH, "utf-8");
    return JSON.parse(raw) as HistoricoItem[];
  } catch {
    return [];
  }
}

function salvarHistorico(itens: HistoricoItem[]) {
  fs.writeFileSync(HISTORICO_PATH, JSON.stringify(itens, null, 2), "utf-8");
}

// GET — retorna todos os itens
export async function GET() {
  const historico = lerHistorico();
  return NextResponse.json({ historico });
}

// POST — adiciona um item
export async function POST(req: NextRequest) {
  try {
    const item = (await req.json()) as HistoricoItem;
    const historico = lerHistorico();
    const atualizado = [item, ...historico].slice(0, MAX_ITENS);
    salvarHistorico(atualizado);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}

// DELETE — limpa o histórico
export async function DELETE() {
  salvarHistorico([]);
  return NextResponse.json({ ok: true });
}
