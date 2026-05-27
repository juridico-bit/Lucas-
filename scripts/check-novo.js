"use strict";
const PizZip = require("pizzip");
const fs = require("fs");
const buf = fs.readFileSync("templates/voo-internacional-multi-autor-novo.docx");
const zip = new PizZip(buf);
const norm = {};
Object.keys(zip.files).forEach(k => { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
zip.files = norm;
const xml = zip.file("word/document.xml").asText();
const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const placeholders = [...text.matchAll(/\{([A-Z_0-9#/]+)\}/g)].map(m => m[1]);
const unique = [...new Set(placeholders)];
console.log("Placeholders:", unique.join(", "));
console.log("Tem TEXTO_COMPETENCIA_TERRITORIAL:", unique.includes("TEXTO_COMPETENCIA_TERRITORIAL"));
console.log("Tem FORO_DESCRICAO:", unique.includes("FORO_DESCRICAO"));

const hasComp = text.includes("Nestes casos a compet");
console.log("Tem texto fixo competencia:", hasComp);
if (hasComp) {
  const idx = text.indexOf("Nestes casos a compet");
  console.log("Trecho:", text.substring(idx, idx + 250));
}
