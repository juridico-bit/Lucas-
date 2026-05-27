export const runtime = "nodejs";

/**
 * Classifica automaticamente o tipo de documento enviado (PDF ou imagem).
 * Usada em AbaDocumentos para mostrar labels antes da extração completa.
 *
 * POST /api/classificar-documento
 * Body: FormData { file: File }
 *
 * Resposta: { tipo, label, emoji, confianca: "alta"|"media"|"baixa" }
 *
 * Arquivos > 5 MB retornam tipo "outro" sem chamar a IA.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropic";
import { enqueueAI } from "@/lib/ai-queue";

// ── Catálogo de tipos ────────────────────────────────────────────────────────

const TIPOS = [
  "bilhete_eletronico",
  "cartao_embarque",
  "comprovante_gasto",
  "nota_fiscal",
  "print_conversa",
  "documento_pessoal",
  "passaporte",
  "comprovante_reserva",
  "prontuario_medico",
  "outro",
] as const;

type Tipo = (typeof TIPOS)[number];

const CATALOGO: Record<Tipo, { label: string; emoji: string }> = {
  bilhete_eletronico:  { label: "Bilhete eletrônico",    emoji: "✈️" },
  cartao_embarque:     { label: "Cartão de embarque",    emoji: "🎫" },
  comprovante_gasto:   { label: "Comprovante de gasto",  emoji: "🧾" },
  nota_fiscal:         { label: "Nota fiscal",           emoji: "📋" },
  print_conversa:      { label: "Print de conversa",     emoji: "💬" },
  documento_pessoal:   { label: "Documento pessoal",     emoji: "🪪" },
  passaporte:          { label: "Passaporte",             emoji: "🛂" },
  comprovante_reserva: { label: "Comprovante de reserva",emoji: "🏨" },
  prontuario_medico:   { label: "Prontuário/atestado",   emoji: "🏥" },
  outro:               { label: "Outro documento",       emoji: "📎" },
};

const PROMPT = `Você analisa documentos de processos judiciais de atraso de voo aéreo no Brasil.

Classifique este documento em EXATAMENTE UMA das categorias:
- bilhete_eletronico  → e-ticket, comprovante de reserva/compra do voo original
- cartao_embarque     → boarding pass (físico, PDF ou print)
- comprovante_gasto   → recibo, cupom fiscal, nota de restaurante, farmácia, táxi, Uber, hotel
- nota_fiscal         → NF-e, DANFE, nota fiscal eletrônica
- print_conversa      → print de WhatsApp, e-mail, SMS, chat, redes sociais
- documento_pessoal   → RG, CPF, CNH, certidão, identidade
- passaporte          → passaporte
- comprovante_reserva → reserva de hotel, aluguel de carro, ingresso de evento, voucher
- prontuario_medico   → atestado médico, prontuário, receita, laudo
- outro               → qualquer tipo que não se enquadre acima

Responda APENAS com JSON válido, sem texto adicional:
{"tipo":"categoria_aqui","confianca":"alta|media|baixa"}`;

// ── Normaliza MIME type de imagem para o que o SDK aceita ────────────────────
function normalizarMime(
  mime: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mime === "image/png")  return "image/png";
  if (mime === "image/gif")  return "image/gif";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg"; // default seguro
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Lê FormData
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Campo 'file' ausente" }, { status: 400 });
  }

  // Limite de 5 MB — arquivos maiores não são classificados para não atrasar o UX
  const MAX_BYTES = 5 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({
      tipo: "outro",
      label: "Arquivo grande — não classificado",
      emoji: "📎",
      confianca: "baixa",
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  // Monta o bloco de conteúdo para a API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentBlock: any = isPdf
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type: normalizarMime(file.type),
          data: base64,
        },
      };

  try {
    const client = createAnthropicClient();
    const response = await enqueueAI(
      () => client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 64,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
      "classificar-documento",
    );

    const raw =
      response.content[0]?.type === "text" ? response.content[0].text ?? "" : "";

    // Extrai o JSON da resposta (ignora possível texto ao redor)
    const match = raw.match(/\{[^}]+\}/);
    if (!match) throw new Error(`Resposta inválida: ${raw}`);

    const parsed = JSON.parse(match[0]) as { tipo?: string; confianca?: string };
    const tipo: Tipo = TIPOS.includes(parsed.tipo as Tipo)
      ? (parsed.tipo as Tipo)
      : "outro";
    const confianca = (["alta", "media", "baixa"] as const).includes(
      parsed.confianca as "alta" | "media" | "baixa"
    )
      ? (parsed.confianca as "alta" | "media" | "baixa")
      : "media";

    return NextResponse.json({
      tipo,
      label: CATALOGO[tipo].label,
      emoji: CATALOGO[tipo].emoji,
      confianca,
    });
  } catch (err) {
    console.error("[classificar-documento] erro:", err instanceof Error ? err.message : err);
    // Falha silenciosa — retorna "outro" para não bloquear o fluxo
    return NextResponse.json({
      tipo: "outro",
      label: "Não identificado",
      emoji: "📎",
      confianca: "baixa",
    });
  }
}
