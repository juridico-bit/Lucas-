/**
 * Opções de formatação para textoParaOOXML.
 * Permite customizar fonte, tamanho e cor sem mudar a lógica do conversor.
 */
export interface OOXMLOpts {
  /** XML dentro de <w:pPr> — substituí completamente o padrão se fornecido */
  pPrInner?: string;
  /** XML dentro de <w:rPr> para runs normais (ex.: fonte Garamond) */
  rPrInner?: string;
  /** XML EXTRA dentro de <w:rPr> para runs em negrito (acrescenta ao rPrInner) */
  rPrBoldExtra?: string;
}

/**
 * Converte texto com marcadores markdown simples em XML OOXML (Word).
 *
 * Marcadores suportados:
 *   **texto**  → negrito
 *   \n\n       → novo parágrafo
 *   \n         → quebra de linha dentro do parágrafo
 *
 * O resultado é uma string de XML pronto para injeção via {~PLACEHOLDER} no docxtemplater.
 * Cada parágrafo herda o estilo "Normal" com justificação bilateral (jc:both).
 *
 * Passar `opts` para customizar fonte/tamanho/cor (ex.: Garamond 13pt do template).
 */
export function textoParaOOXML(texto: string, opts?: OOXMLOpts): string {
  // Defesa em tempo de execução: garante que `texto` é sempre uma string,
  // mesmo que o chamador passe undefined/null (evita "undefined" literal no .docx).
  const textoStr = (texto == null ? "" : String(texto)).trim();
  if (!textoStr) return "<w:p><w:r><w:t></w:t></w:r></w:p>";

  const pPrInner = opts?.pPrInner ??
    '<w:jc w:val="both"/><w:spacing w:after="120"/><w:ind w:firstLine="720"/>';
  const rPrInner = opts?.rPrInner ?? "";
  const rPrBoldExtra = opts?.rPrBoldExtra ?? "<w:b/><w:bCs/>";

  // Divide em parágrafos por linha em branco dupla
  const paragrafos = textoStr.split(/\n{2,}/);

  return paragrafos
    .map((paragrafo) => {
      // Dentro de cada parágrafo, processa quebras de linha simples e negrito
      const linhas = paragrafo.split("\n");
      const runs: string[] = [];

      linhas.forEach((linha, idxLinha) => {
        // Processa **negrito** dentro da linha
        const partes = linha.split(/\*\*([^*]+)\*\*/);
        partes.forEach((parte, idxParte) => {
          if (!parte) return;
          const isNegrito = idxParte % 2 === 1;
          const textoEscapado = escapeXml(parte);
          if (isNegrito) {
            const rPrBold = rPrInner + rPrBoldExtra;
            runs.push(
              `<w:r><w:rPr>${rPrBold}</w:rPr><w:t xml:space="preserve">${textoEscapado}</w:t></w:r>`
            );
          } else {
            const rPrNormal = rPrInner ? `<w:rPr>${rPrInner}</w:rPr>` : "";
            runs.push(
              `<w:r>${rPrNormal}<w:t xml:space="preserve">${textoEscapado}</w:t></w:r>`
            );
          }
        });

        // Quebra de linha simples entre linhas (não no final)
        if (idxLinha < linhas.length - 1) {
          runs.push(`<w:r><w:br/></w:r>`);
        }
      });

      const runsXml = runs.join("");
      return (
        `<w:p>` +
        `<w:pPr>${pPrInner}</w:pPr>` +
        runsXml +
        `</w:p>`
      );
    })
    .join("");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
