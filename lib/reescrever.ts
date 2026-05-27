import { createAnthropicClient } from "./anthropic";

/**
 * Reescreve a descrição de compromisso perdido com prompt específico:
 * terceira pessoa, parágrafo desenvolvido, negrito nas partes principais, persuasivo.
 *
 * REGRA FIXA: o texto deve ser desenvolvido (sem limite de frases),
 * com as partes mais importantes em **negrito**.
 * Os marcadores **...** são preservados — convertidos para negrito real no .docx
 * via textoParaOOXML({~DESC_COMPROMISSO}).
 */
export async function reescreverCompromisso(texto: string): Promise<string> {
  // Garante que texto é string não-vazia antes de chamar a IA
  // Guarda contra string vazia E contra o literal "undefined" que pode vir do localStorage
  const textoLimpo = (texto == null ? "" : String(texto)).trim();
  if (!textoLimpo || textoLimpo.toLowerCase() === "undefined") return "";

  try {
    const client = createAnthropicClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Você recebe uma descrição de perda de compromisso profissional ou pessoal causada por atraso/cancelamento de voo. Reescreva em terceira pessoa, sem travessões, sem bullets, em 2 ou 3 parágrafos bem desenvolvidos. Use linguagem jurídica formal e persuasiva. Valorize o prejuízo causado ao autor. Desperte empatia no juiz.

REGRAS OBRIGATÓRIAS:
1. Texto em terceira pessoa ("a parte autora", "o requerente", "os autores").
2. Sem travessões (—). Use vírgulas ou ponto e vírgula.
3. 2 ou 3 parágrafos corridos, separados por linha em branco — sem bullets ou listas.
4. Texto desenvolvido: mínimo 4 frases no total, bem fundamentado e persuasivo.
5. Marque as partes mais importantes com **negrito** usando a sintaxe **texto em negrito**. Exemplos do que deve ficar em negrito: o tipo de compromisso, o horário/data, o prejuízo sofrido.
6. Retorne apenas o texto final, sem introduções, comentários ou aspas.

Exemplo de entrada: "Tinha reunião de negócios às 14h com clientes internacionais"
Exemplo de saída:
"A parte autora havia agendado, com a devida antecedência, **reunião de negócios para as 14h** com clientes internacionais, compromisso este de **grande relevância profissional e financeira** para o desenvolvimento de suas atividades comerciais.

O atraso indevido ocasionado pela requerida tornou **impossível o cumprimento do referido compromisso**, causando à autora constrangimento e prejuízos de ordem profissional que se reverberaram em sua reputação perante os clientes. **Tal situação poderia ter sido evitada** caso a companhia aérea tivesse adotado as providências mínimas esperadas de um fornecedor de serviços, demonstrando absoluto descaso com o consumidor."

TEXTO ORIGINAL:
${textoLimpo}`,
        },
      ],
    });

    // Extrai o texto da resposta com optional chaining defensivo
    const raw =
      response.content[0]?.type === "text"
        ? (response.content[0].text ?? textoLimpo)
        : textoLimpo;

    // Sanitização: remove XML/HTML e itálico simples, mas PRESERVA **negrito**
    // Os marcadores ** são convertidos para <w:b/> no .docx via textoParaOOXML
    return (raw || textoLimpo)
      .trim()
      .replace(/<[^>]+>/g, " ")           // strip XML/HTML (nunca deve aparecer)
      .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "$1") // strip *itálico* (mas não **)
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    // Em caso de falha da IA, devolve o texto original para não bloquear a geração
    return textoLimpo;
  }
}

export async function reescreverTerceiraPessoa(texto: string): Promise<string> {
  const textoNorm = (texto == null ? "" : String(texto)).trim();
  if (!textoNorm || textoNorm.toLowerCase() === "undefined") return "";

  const client = createAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Reescreva o texto abaixo em terceira pessoa, em linguagem jurídica formal e persuasiva brasileira, como se fosse a narrativa de um advogado descrevendo os fatos na petição inicial. O texto deve ser convincente, valorizar o sofrimento e os prejuízos do autor, e despertar empatia no juiz. Mantenha todos os fatos, datas, horários e valores sem alterar. Não invente informações. Não use travessões (—) em hipótese alguma; use vírgulas ou ponto e vírgula no lugar.

Divida o texto em parágrafos coerentes, separados por linha em branco (\\n\\n entre parágrafos). Não use negrito, itálico, asteriscos, marcadores de lista, XML, HTML ou qualquer outra formatação especial — apenas texto puro simples.

Retorne APENAS o texto reescrito, sem introduções, comentários ou explicações.

TEXTO ORIGINAL:
${textoNorm}`,
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text : textoNorm;

  // Sanitização defensiva: strip de XML/HTML, asteriscos, normalização de espaços
  const cleaned = raw
    .trim()
    .replace(/<[^>]+>/g, " ")           // Remove tags XML/HTML (saída inesperada do modelo)
    .replace(/\*\*(.*?)\*\*/g, "$1")    // Remove marcadores **negrito**
    .replace(/\*(.*?)\*/g, "$1")        // Remove marcadores *itálico*
    .replace(/[^\S\n]+/g, " ")          // Normaliza espaços horizontais
    .replace(/\n{3,}/g, "\n\n")         // Máx. 2 quebras consecutivas
    .trim();

  return cleaned;
}
