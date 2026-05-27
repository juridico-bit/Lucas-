import { NextRequest, NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropic";
import { enqueueAI } from "@/lib/ai-queue";

export async function POST(request: NextRequest) {
  try {
    const client = createAnthropicClient();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";

    const mediaTypeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    const mediaType = (mediaTypeMap[ext] ?? "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "image/gif";

    const response = await enqueueAI(
      () => client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 50,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: "Extraia a data de nascimento deste documento. Retorne SOMENTE a data no formato DD/MM/AAAA, sem mais nada. Se não encontrar, retorne apenas a palavra NENHUMA.",
              },
            ],
          },
        ],
      }),
      "extrair-nascimento",
    );

    const texto =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "";

    if (!texto || texto === "NENHUMA" || !/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
      return NextResponse.json(
        { error: "Data de nascimento não encontrada no documento" },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: texto });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
