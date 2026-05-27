import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET(request: NextRequest) {
  try {
    const arquivo = request.nextUrl.searchParams.get("arquivo");

    if (!arquivo || !arquivo.endsWith(".docx") || arquivo.includes("..") || arquivo.includes("\\")) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    }
    // Permite apenas raiz ou subpasta "backup/"
    const partes = arquivo.split("/");
    if (partes.length > 2 || (partes.length === 2 && partes[0] !== "backup")) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    }

    const filePath = join(process.cwd(), "templates", ...partes);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
    }

    const buf = readFileSync(filePath);

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${arquivo}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
