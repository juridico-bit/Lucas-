export const runtime = "nodejs";

/**
 * API de rascunhos na nuvem — permite gerar um link compartilhável
 * para que outro usuário (paralegal, outro computador) possa continuar
 * o preenchimento de um caso sem depender do localStorage.
 *
 * POST /api/rascunho          — salva rascunho, retorna { id, expiraEm }
 * GET  /api/rascunho?id=xxx   — carrega rascunho pelo ID
 *
 * Armazenamento: data/rascunhos/<id>.json (um arquivo por rascunho)
 * Expiração: 7 dias (limpeza lazy no POST)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const RASCUNHOS_DIR = join(process.cwd(), "data", "rascunhos");
const EXPIRY_DAYS = 7;
const MAX_RASCUNHOS = 500; // limite de segurança

function ensureDir() {
  if (!existsSync(RASCUNHOS_DIR)) {
    mkdirSync(RASCUNHOS_DIR, { recursive: true });
  }
}

/** Remove arquivos mais antigos que EXPIRY_DAYS dias. Chamado a cada POST. */
function limparExpirados() {
  try {
    const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const arquivos = readdirSync(RASCUNHOS_DIR).filter((f) => f.endsWith(".json"));

    // Apaga expirados
    for (const f of arquivos) {
      const caminho = join(RASCUNHOS_DIR, f);
      try {
        const { mtimeMs } = statSync(caminho);
        if (mtimeMs < cutoff) unlinkSync(caminho);
      } catch { /* silencioso */ }
    }

    // Se ainda houver mais de MAX_RASCUNHOS, apaga os mais antigos
    const restantes = readdirSync(RASCUNHOS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ f, mtime: statSync(join(RASCUNHOS_DIR, f)).mtimeMs }))
      .sort((a, b) => a.mtime - b.mtime);

    while (restantes.length > MAX_RASCUNHOS) {
      const { f } = restantes.shift()!;
      try { unlinkSync(join(RASCUNHOS_DIR, f)); } catch { /* silencioso */ }
    }
  } catch { /* silencioso */ }
}

// ── GET /api/rascunho?id=xxx ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";

  // Valida formato: exatamente 8 caracteres hex
  if (!/^[a-f0-9]{8}$/.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  ensureDir();
  const arquivo = join(RASCUNHOS_DIR, `${id}.json`);

  if (!existsSync(arquivo)) {
    return NextResponse.json(
      { error: "Rascunho não encontrado ou expirado" },
      { status: 404 }
    );
  }

  try {
    const payload = JSON.parse(readFileSync(arquivo, "utf8"));

    // Verifica expiração pelo campo gravado (dupla proteção)
    if (payload.expiraEm && new Date(payload.expiraEm) < new Date()) {
      try { unlinkSync(arquivo); } catch { /* silencioso */ }
      return NextResponse.json(
        { error: "Rascunho expirado" },
        { status: 410 }
      );
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Erro ao ler rascunho" }, { status: 500 });
  }
}

// ── POST /api/rascunho ───────────────────────────────────────────────────────
// Body: { dados: DadosFormulario, camposIA: string[], modulo: string }
export async function POST(req: NextRequest) {
  let body: { dados: unknown; camposIA: unknown; modulo: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.dados || typeof body.modulo !== "string") {
    return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 });
  }

  ensureDir();
  limparExpirados();

  const id = randomBytes(4).toString("hex"); // 8 chars hex
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    id,
    modulo: body.modulo,
    dados: body.dados,
    camposIA: Array.isArray(body.camposIA) ? body.camposIA : [],
    criadoEm: agora.toISOString(),
    expiraEm,
  };

  try {
    writeFileSync(
      join(RASCUNHOS_DIR, `${id}.json`),
      JSON.stringify(payload, null, 2),
      "utf8"
    );
    return NextResponse.json({ id, expiraEm });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
