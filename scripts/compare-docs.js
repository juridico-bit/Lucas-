"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

function extractText(path) {
  const buf = fs.readFileSync(path);
  const zip = new PizZip(buf);
  const norm = {};
  Object.keys(zip.files).forEach(k => { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
  zip.files = norm;
  const xml = zip.file("word/document.xml").asText();
  return xml.replace(/<\/w:p>/g, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .split("\n")
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .join("\n");
}

const gerada = extractText("C:/Users/lucas/Downloads/Inicial Internacional - Mariana Oliveira Velloso e Renato Paixão De Mendonca (5).docx");
const template = extractText("C:/Users/lucas/OneDrive/Área de Trabalho/voo-internacional-multi-autor.docx");

console.log("=== DOCUMENTO GERADO (primeiras 120 linhas) ===");
console.log(gerada.split("\n").slice(0, 120).join("\n"));
console.log("\n\n=== TEMPLATE NOVO (primeiras 120 linhas) ===");
console.log(template.split("\n").slice(0, 120).join("\n"));
