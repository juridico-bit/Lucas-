import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient } from "@/lib/anthropic";
import { enqueueAI } from "@/lib/ai-queue";

// Cliente instanciado dentro da função para garantir leitura do env em runtime

const SYSTEM_PROMPT = `Você é um extrator de dados jurídicos especializado em casos de atraso e cancelamento de voos. Analise TODOS os documentos enviados (bilhetes, cartões de embarque, comprovantes de gastos, conversas de WhatsApp, e-mails, prints de redes sociais, etc.) e retorne APENAS um JSON válido, sem texto adicional, sem markdown, sem explicações. Estrutura exata:

{
  "companhia": "",
  "tipo_rota": "direto, conexao ou 2conexoes",
  "voos": [
    {
      "numero": "",
      "origem_cidade": "",
      "origem_sigla": "",
      "destino_cidade": "",
      "destino_sigla": "",
      "data": "",
      "dia_semana": "",
      "partida": "",
      "chegada": ""
    }
  ],
  "voo_realocacao": {
    "numero": "",
    "origem_cidade": "",
    "destino_cidade": "",
    "data": "",
    "dia_semana": "",
    "partida": "",
    "chegada": ""
  },
  "chegada_prevista": "",
  "chegada_real": "",
  "gastos": [
    { "categoria": "", "valor": "" }
  ],
  "relato": "",
  "compromisso_perdido": "",
  "compromisso_detalhe": ""
}

Regras gerais:
- Campo não encontrado = string vazia. Nunca invente dados.
- "tipo_rota": use "direto" para voo sem escala, "conexao" para exatamente 1 escala/conexão, "2conexoes" para 2 escalas/conexões.
- Datas: DD/MM/AAAA. Horários: HH:MM. Valores: sem símbolo, formato 0000.00.
- Siglas de aeroporto: use o código IATA de 3 letras. ATENÇÃO para São Paulo: Congonhas = CGH | Guarulhos/Internacional = GRU | Viracopos/Campinas = VCP. Para Rio de Janeiro: Galeão/Internacional = GIG | Santos Dumont = SDU. NUNCA deixe a sigla vazia se a cidade for São Paulo ou Rio de Janeiro — identifique qual aeroporto pelo nome, código no bilhete ou contexto do voo.
- "chegada_prevista" e "chegada_real": OBRIGATORIAMENTE no formato "DD/MM/AAAA HH:MM" (data + hora juntos, nunca só o horário). Se o documento mostrar apenas o horário de chegada sem a data, use a data do voo de destino como data base. Se a chegada real for após meia-noite, a data pode ser o dia seguinte ao voo — ajuste corretamente.

Regras para "compromisso_perdido" e "compromisso_detalhe":
- Se houver conversa de WhatsApp, e-mail, print ou qualquer documento que comprove um compromisso, evento, reunião, encontro ou obrigação que o passageiro perdeu ou ficou em risco de perder por causa do atraso/cancelamento do voo, extraia as informações.
- "compromisso_perdido": descreva o tipo de compromisso (ex: "reunião de negócios", "evento esportivo", "consulta médica", "casamento", "evento profissional").
- "compromisso_detalhe": descreva data, horário e local do compromisso conforme o documento (ex: "às 22h00 do dia 07/04/2026 no hotel").
- Conversas de WhatsApp são válidas como comprovante — leia as mensagens e identifique o compromisso mencionado.

Inclua também um campo "_confianca" no mesmo JSON, usando os mesmos nomes dos campos principais. Para campos de arrays use "campo.indice.subcampo" (ex: "voos.0.numero"). Para compromisso use "desc_compromisso" e "desc_compromisso_detalhe". Indique o nível de certeza de cada campo NÃO VAZIO:
- "alta": encontrado explicitamente no documento (texto impresso, número visível, etc.)
- "media": inferido com boa certeza (deduzido por contexto, IATA calculada, etc.)
- "baixa": incerto — valor assumido ou praticamente um chute

Inclua em "_confianca" SOMENTE campos que foram preenchidos. Exemplo:
"_confianca": {"companhia":"alta","voos.0.numero":"alta","voos.0.data":"alta","chegada_prevista":"media","chegada_real":"baixa"}`;

export async function POST(request: NextRequest) {
  try {
    const client = createAnthropicClient();
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const relatoTexto = formData.get("relato_texto") as string | null;
    const realocadoTexto = formData.get("realocado_texto") as string | null;
    const compromissoTexto = formData.get("compromisso_texto") as string | null;

    if (files.length === 0 && !relatoTexto && !compromissoTexto) {
      return NextResponse.json(
        { error: "Nenhum arquivo ou texto enviado" },
        { status: 400 }
      );
    }

    const contentBlocks: Anthropic.MessageParam["content"] = [];

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      // Detecta tipo pelo MIME type OU pela extensão do arquivo (mais robusto)
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const isPdf =
        file.type === "application/pdf" ||
        ext === "pdf";

      const imageTypeMap: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
      };

      const imageMediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" =
        (file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp") ||
        imageTypeMap[ext] ||
        "image/jpeg";

      if (isPdf) {
        contentBlocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        } as Anthropic.DocumentBlockParam);
      } else {
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: imageMediaType,
            data: base64,
          },
        } as Anthropic.ImageBlockParam);
      }
    }

    if (relatoTexto) {
      contentBlocks.push({
        type: "text",
        text: `RELATO DA RESOLVVI:\n${relatoTexto}`,
      });
    }
    if (realocadoTexto) {
      contentBlocks.push({
        type: "text",
        text: `INFORMAÇÕES DO VOO DE REALOCAÇÃO (novo voo oferecido pela companhia):\n${realocadoTexto}`,
      });
    }
    if (compromissoTexto) {
      contentBlocks.push({
        type: "text",
        text: `DESCRIÇÃO DA PERDA DE COMPROMISSO:\n${compromissoTexto}`,
      });
    }

    contentBlocks.push({
      type: "text",
      text: "Extraia os dados jurídicos destes documentos e retorne o JSON conforme instruído.",
    });

    const response = await enqueueAI(
      () => client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contentBlocks }],
      }),
      "extrair-dados",
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let dados;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      dados = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      return NextResponse.json(
        { error: "Falha ao interpretar resposta da IA" },
        { status: 500 }
      );
    }

    // Extrai e remove _confianca do objeto de dados
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const confiancas: Record<string, string> = (dados as any)._confianca ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (dados as any)._confianca;

    return NextResponse.json({ dados, confiancas });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
