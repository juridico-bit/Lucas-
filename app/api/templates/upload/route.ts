import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, existsSync, copyFileSync, mkdirSync } from "fs";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const nome = formData.get("nome") as string | null;

    if (!file || !nome) {
      return NextResponse.json(
        { error: "Arquivo e nome são obrigatórios" },
        { status: 400 }
      );
    }

    const nomeArquivo = nome
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .concat(".docx");

    const templatesDir = join(process.cwd(), "templates");
    const destPath = join(templatesDir, nomeArquivo);

    // ── Backup automático antes de sobrescrever ─────────────────────────────
    let backupArquivo: string | null = null;
    if (existsSync(destPath)) {
      const backupDir = join(templatesDir, "backup");
      if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
      const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      backupArquivo = nomeArquivo.replace(".docx", `_backup_${ts}.docx`);
      copyFileSync(destPath, join(backupDir, backupArquivo));
    }

    const buffer = await file.arrayBuffer();
    writeFileSync(destPath, Buffer.from(buffer));

    return NextResponse.json({ sucesso: true, arquivo: nomeArquivo, backup: backupArquivo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
