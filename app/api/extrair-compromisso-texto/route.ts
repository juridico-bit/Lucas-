import { NextRequest, NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  try {
    const { texto } = (await req.json()) as { texto: string };
    if (!texto?.trim()) {
      return NextResponse.json({ tipo: "pessoal", descricao: "", detalhe: "" });
    }

    const client = createAnthropicClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Analise o texto abaixo sobre o motivo/propósito de uma viagem aérea que foi prejudicada por atraso ou cancelamento, e classifique o tipo de compromisso perdido.

Retorne APENAS um JSON válido:
{"tipo": "pessoal" ou "profissional", "descricao": "...", "detalhe": "..."}

Classificação de TIPO:
- "pessoal": descanso, lazer, turismo, férias, feriado (Páscoa, Natal, Carnaval, etc.), aniversário, festa, show, batizado, casamento, confraternização, viagem de prazer, adaptação de fuso horário, encontro familiar, evento social, chegar antes de datas comemorativas.
- "profissional": reunião de trabalho, negócios, congresso, palestra, seminário, audiência judicial, cirurgia ou atendimento médico como profissional, evento corporativo, compromisso de trabalho, apresentação profissional.

Dúvida? Se o motivo for pessoal, de lazer ou família → "pessoal". Se for trabalho, negócio ou atividade profissional → "profissional".

Regras dos campos:
- "descricao": texto curto e descritivo em português (máx. 60 caracteres). Ex: "chegada antes da Páscoa para descanso e adaptação ao fuso"
- "detalhe": data, horário ou local específico se mencionado. Caso contrário, deixe "".
- Retorne APENAS o JSON, sem explicações.

TEXTO:
${texto}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return NextResponse.json({ tipo: "pessoal", descricao: "", detalhe: "" });

    const parsed = JSON.parse(match[0]) as {
      tipo?: string;
      descricao?: string;
      detalhe?: string;
    };

    return NextResponse.json({
      tipo: parsed.tipo === "profissional" ? "profissional" : "pessoal",
      descricao: parsed.descricao ?? "",
      detalhe: parsed.detalhe ?? "",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    );
  }
}
