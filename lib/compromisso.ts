import { createAnthropicClient } from "./anthropic";

/**
 * Gera a descrição do compromisso perdido em terceira pessoa jurídica,
 * com parágrafos desenvolvidos e linguagem persuasiva.
 *
 * Modelo: claude-sonnet-4-5  |  max_tokens: 600
 * Usado em: gerar-peca/route.ts → placeholder {DESC_COMPROMISSO} do template nacional
 */
export async function gerarDescCompromisso(texto: string): Promise<string> {
  const textoLimpo = (texto == null ? "" : String(texto)).trim();
  // Guarda contra string vazia E contra o literal "undefined" que pode vir do localStorage
  if (!textoLimpo || textoLimpo.toLowerCase() === "undefined") return "";

  try {
    const client = createAnthropicClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Você recebe uma descrição de perda de compromisso profissional ou pessoal causada por atraso/cancelamento de voo. Reescreva em terceira pessoa, sem travessões, sem bullets, em parágrafo corrido e bem desenvolvido. Use linguagem jurídica formal e persuasiva. Valorize o prejuízo causado ao autor. Desperte empatia no juiz.

REGRAS OBRIGATÓRIAS:
1. Texto em terceira pessoa ("a parte autora", "o requerente", "a parte demandante").
2. Sem travessões (—). Use vírgulas ou ponto e vírgula no lugar.
3. Parágrafo corrido, sem bullets ou listas.
4. Texto desenvolvido: mínimo 3 frases, bem fundamentado e persuasivo.
5. Sem negrito, sem asteriscos, sem formatação especial — texto puro simples.
6. Retorne apenas o texto, sem introduções, comentários ou aspas.

TEXTO ORIGINAL:
${textoLimpo}`,
        },
      ],
    });

    const raw =
      response.content[0]?.type === "text"
        ? (response.content[0].text ?? textoLimpo)
        : textoLimpo;

    return (raw || textoLimpo)
      .trim()
      .replace(/<[^>]+>/g, " ")        // strip XML/HTML residual
      .replace(/\*\*(.*?)\*\*/g, "$1") // strip **negrito**
      .replace(/\*(.*?)\*/g, "$1")     // strip *itálico*
      .replace(/[^\S\n]+/g, " ")       // normaliza espaços
      .replace(/\n{3,}/g, "\n\n")      // máx 2 quebras consecutivas
      .trim();
  } catch {
    // Em caso de falha da IA, devolve o texto original — mas filtra o literal "undefined"
    return textoLimpo.toLowerCase() === "undefined" ? "" : textoLimpo;
  }
}
