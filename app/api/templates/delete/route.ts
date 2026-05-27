import { NextRequest, NextResponse } from "next/server";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";

export async function DELETE(request: NextRequest) {
  try {
    const { arquivo } = (await request.json()) as { arquivo: string };

    if (!arquivo || !arquivo.endsWith(".docx")) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    }

    // Prevent path traversal
    if (arquivo.includes("..") || arquivo.includes("/") || arquivo.includes("\\")) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    }

    const filePath = join(process.cwd(), "templates", arquivo);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    unlinkSync(filePath);
    return NextResponse.json({ sucesso: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
