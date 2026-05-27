"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

const buf = fs.readFileSync("templates/voo-internacional-multi-autor-novo.docx");
const zip = new PizZip(buf);
const norm = {};
Object.keys(zip.files).forEach(function(k) { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
zip.files = norm;
const xml = zip.file("word/document.xml").asText();

// Texto limpo por parágrafo
const linhas = xml.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").split("\n")
  .map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

// Procura linhas com AUTOR1 (pode estar fragmentado)
console.log("=== Linhas com 'AUTOR1' (pode estar fragmentado) ===");
linhas.filter(function(l) { return l.includes("AUTOR1") || l.includes("autor1"); })
  .forEach(function(l) { console.log(l.substring(0, 200)); });

// Procura linhas com DATA_PETICAO
console.log("\n=== Linhas com 'DATA_PETICAO' ===");
linhas.filter(function(l) { return l.includes("DATA_PETICAO") || l.includes("peticao") || l.includes("petição"); })
  .forEach(function(l) { console.log(l.substring(0, 200)); });

// Procura linhas com idoso
console.log("\n=== Linhas com 'idoso' ===");
linhas.filter(function(l) { return l.toLowerCase().includes("idoso"); })
  .forEach(function(l) { console.log(l.substring(0, 200)); });

// Procura no XML raw por fragmentos de AUTOR1
console.log("\n=== XML raw: ocorrências de 'AUTOR1' (mostra contexto 150 chars) ===");
var idx = 0;
var count = 0;
while ((idx = xml.indexOf("AUTOR1", idx)) !== -1 && count < 10) {
  console.log("[" + idx + "] ..." + xml.substring(Math.max(0, idx-60), idx+60).replace(/\n/g,"") + "...");
  idx += 6; count++;
}
if (count === 0) console.log("NÃO ENCONTRADO no XML");

// Procura no XML raw por fragmentos de DATA_PETICAO
console.log("\n=== XML raw: ocorrências de 'DATA_PETICAO' ===");
idx = 0; count = 0;
while ((idx = xml.indexOf("DATA_PETICAO", idx)) !== -1 && count < 5) {
  console.log("[" + idx + "] ..." + xml.substring(Math.max(0, idx-60), idx+80).replace(/\n/g,"") + "...");
  idx += 12; count++;
}
if (count === 0) console.log("NÃO ENCONTRADO no XML");

// Primeiras 50 linhas de texto do documento
console.log("\n=== Primeiras 50 linhas do documento ===");
linhas.slice(0, 50).forEach(function(l, i) { console.log("[" + i + "] " + l.substring(0, 180)); });
