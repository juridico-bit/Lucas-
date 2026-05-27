import { NextResponse } from "next/server";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

export interface TemplateInfo {
  nome: string;
  arquivo: string;
  modulo: string;
  data_upload: string;
  ativo: boolean;
}

export async function GET() {
  try {
    const templatesDir = join(process.cwd(), "templates");
    const files = readdirSync(templatesDir).filter((f) => f.endsWith(".docx"));

    const templates: TemplateInfo[] = files.map((file) => {
      const stat = statSync(join(templatesDir, file));
      const nome = file
        .replace(".docx", "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        nome,
        arquivo: file,
        modulo: file.includes("nacional") ? "Voo Nacional" : "Outro",
        data_upload: stat.mtime.toLocaleDateString("pt-BR"),
        ativo: true,
      };
    });

    // Backups automáticos
    const backupDir = join(templatesDir, "backup");
    const backups: { arquivo: string; data: string }[] = existsSync(backupDir)
      ? readdirSync(backupDir)
          .filter((f) => f.endsWith(".docx"))
          .sort()
          .reverse() // mais recentes primeiro
          .map((f) => ({
            arquivo: f,
            data: statSync(join(backupDir, f)).mtime.toLocaleString("pt-BR"),
          }))
      : [];

    return NextResponse.json({ templates, backups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
