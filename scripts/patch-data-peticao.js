"use strict";
/**
 * Substitui o campo TIME \@ (data automática do Word) pelo placeholder
 * {DATA_PETICAO} no template internacional, para que a rota injete a data correta.
 */
const PizZip = require("pizzip");
const fs = require("fs");

const PATH = "templates/voo-internacional-multi-autor-novo.docx";

const buf = fs.readFileSync(PATH);
const zip = new PizZip(buf);
const norm = {};
Object.keys(zip.files).forEach(function(k) { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
zip.files = norm;

let xml = zip.file("word/document.xml").asText();

// Encontra o parágrafo que contém o campo TIME
// O campo aparece como: <w:fldChar>...<w:instrText> TIME \@...
const timIdx = xml.indexOf("TIME");
if (timIdx === -1) { console.log("Campo TIME não encontrado"); process.exit(1); }
console.log("Campo TIME encontrado na posição:", timIdx);
console.log("Contexto:", xml.substring(timIdx - 100, timIdx + 200).replace(/\n/g, "").substring(0, 300));

// Localiza o início e fim do parágrafo que contém o campo TIME
const paraStart = xml.lastIndexOf("<w:p ", timIdx);
const paraEnd   = xml.indexOf("</w:p>", timIdx) + "</w:p>".length;
const paraXml   = xml.substring(paraStart, paraEnd);

console.log("\nParágrafo encontrado (" + paraXml.length + " chars)");
const cleanText = paraXml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
console.log("Texto limpo:", cleanText.substring(0, 200));

// Extrai pPr e rPr para preservar formatação
const pPrMatch = paraXml.match(/(<w:pPr>[\s\S]*?<\/w:pPr>)/);
const pPr = pPrMatch ? pPrMatch[1] : "";

// Preserva o texto ANTES do campo TIME (ex: "São Paulo/SP, ")
// Procura o último <w:t> antes do campo TIME no parágrafo
const beforeTimeXml = paraXml.substring(0, paraXml.indexOf("<w:fldChar"));
const textoAntes = beforeTimeXml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
console.log("Texto antes do campo:", JSON.stringify(textoAntes));

// Procura rPr do último run antes do campo
const runsAntes = [...beforeTimeXml.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)];
let rPr = "";
if (runsAntes.length > 0) {
  const lastRun = runsAntes[runsAntes.length - 1][0];
  const rPrM = lastRun.match(/(<w:rPr>[\s\S]*?<\/w:rPr>)/);
  if (rPrM) rPr = rPrM[1];
}

// Monta novo parágrafo:
// "São Paulo/SP, {DATA_PETICAO}." mantendo formatação original
const newPara =
  "<w:p>" +
  pPr +
  // Texto antes do campo
  (textoAntes
    ? "<w:r>" + rPr + "<w:t xml:space=\"preserve\">" + textoAntes + " </w:t></w:r>"
    : "") +
  // Placeholder da data
  "<w:r>" + rPr + "<w:t>{DATA_PETICAO}</w:t></w:r>" +
  "<w:r>" + rPr + "<w:t>.</w:t></w:r>" +
  "</w:p>";

xml = xml.slice(0, paraStart) + newPara + xml.slice(paraEnd);

zip.file("word/document.xml", xml);
const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync(PATH, out);

// Copia para o arquivo padrão também
fs.writeFileSync("templates/voo-internacional-multi-autor.docx", out);

console.log("\nTemplate atualizado (" + out.length + " bytes)");
console.log("Verificando placeholder...");

// Verifica
const zip2 = new PizZip(out);
const norm2 = {};
Object.keys(zip2.files).forEach(function(k) { norm2[k.replace(/\\/g, "/")] = zip2.files[k]; });
zip2.files = norm2;
const xml2 = zip2.file("word/document.xml").asText();
console.log("{DATA_PETICAO} presente:", xml2.includes("{DATA_PETICAO}"));
console.log("Campo TIME ainda presente:", xml2.includes("TIME \\@") || xml2.includes("TIME \\@"));
