"use strict";
/**
 * Substitui o trecho fixo sobre competência territorial em ambos os templates
 * pelo placeholder {TEXTO_COMPETENCIA_TERRITORIAL}, para que a rota preencha
 * dinamicamente conforme o domicílio do autor.
 */
const PizZip = require("pizzip");
const fs = require("fs");

const TARGETS = [
  "templates/voo-nacional-1-autor.docx",
  "templates/voo-internacional-multi-autor-novo.docx",
];

// O trecho que queremos tornar dinâmico (pode estar em um ou mais runs)
// Estratégia: encontrar o parágrafo que contém "Nestes casos a competência é relativa"
// e substituir a parte dinâmica (da vírgula de "optando" até o fim do parágrafo)
// por {TEXTO_COMPETENCIA_TERRITORIAL}.

const FIXED_PREFIX = "Nestes casos a compet";  // marcador único no template

function patch(path) {
  const buf = fs.readFileSync(path);
  const zip = new PizZip(buf);
  const norm = {};
  Object.keys(zip.files).forEach(k => { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
  zip.files = norm;

  let xml = zip.file("word/document.xml").asText();

  // Localiza o parágrafo que contém o texto
  // Primeiro, find the paragraph start before FIXED_PREFIX
  const markerIdx = xml.indexOf(FIXED_PREFIX);
  if (markerIdx === -1) {
    console.log(`${path}: marcador não encontrado — pulando`);
    return;
  }

  const paraStart = xml.lastIndexOf("<w:p ", markerIdx);
  const paraEnd   = xml.indexOf("</w:p>", markerIdx) + "</w:p>".length;
  const paraXml   = xml.substring(paraStart, paraEnd);

  console.log(`\n${path}: parágrafo encontrado (${paraXml.length} chars)`);

  // Extrai o texto limpo do parágrafo para verificar
  const cleanText = paraXml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  console.log("Texto:", cleanText.substring(0, 200));

  // Estratégia: extrair o pPr (formatação do parágrafo), preservar o início do texto
  // até "Nestes casos..." e substituir o restante com o placeholder

  // Extrai o pPr do parágrafo original para manter formatação
  const pPrMatch = paraXml.match(/(<w:pPr>[\s\S]*?<\/w:pPr>)/);
  const pPr = pPrMatch ? pPrMatch[1] : "";

  // Extrai rPr do primeiro run de texto para manter fonte/tamanho
  const firstRunMatch = paraXml.match(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/);
  let rPr = "";
  if (firstRunMatch) {
    const rPrMatch = firstRunMatch[1].match(/(<w:rPr>[\s\S]*?<\/w:rPr>)/);
    if (rPrMatch) rPr = rPrMatch[1];
  }

  // Monta o novo parágrafo com o placeholder
  const newPara =
    `<w:p>` +
    pPr +
    `<w:r>${rPr}<w:t xml:space="preserve">{TEXTO_COMPETENCIA_TERRITORIAL}</w:t></w:r>` +
    `</w:p>`;

  xml = xml.slice(0, paraStart) + newPara + xml.slice(paraEnd);

  zip.file("word/document.xml", xml);
  const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  fs.writeFileSync(path, out);
  console.log(`${path}: salvo (${out.length} bytes)`);
}

TARGETS.forEach(patch);
console.log("\nDone.");
