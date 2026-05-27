import { NextRequest, NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

    const client = createAnthropicClient();
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mime = file.type.startsWith("image/") ? file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp" : "image/jpeg";

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mime, data: base64 },
          },
          {
            type: "text",
            text: `Analise este comprovante de gasto e extraia exatamente:
1. categoria: tipo do gasto em português minúsculo. Ex: "alimentação", "transporte", "hospedagem", "táxi", "lanche", "passagem aérea"
2. valor: o valor total pago em reais, apenas números com ponto decimal. Ex: "45.90"
3. descricao: nome do estabelecimento ou descrição curta. Ex: "McDonald's Aeroporto GRU"

Retorne SOMENTE o JSON sem explicações:
{"categoria": "...", "valor": "...", "descricao": "..."}

Se não conseguir extrair um campo, use string vazia ""`,
          },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return NextResponse.json({ categoria: "", valor: "", descricao: "" });
    const parsed = JSON.parse(match[0]) as { categoria?: string; valor?: string; descricao?: string };
    return NextResponse.json({
      categoria: parsed.categoria ?? "",
      valor: parsed.valor ?? "",
      descricao: parsed.descricao ?? "",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
