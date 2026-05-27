"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

const buf = fs.readFileSync("templates/voo-internacional-multi-autor-novo.docx");
const zip = new PizZip(buf);
const norm = {};
Object.keys(zip.files).forEach(function(k) { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
zip.files = norm;

// Mostra arquivos disponíveis
console.log("=== Arquivos word/ no template ===");
Object.keys(norm).filter(function(k) { return k.startsWith("word/"); }).sort()
  .forEach(function(k) { console.log(k); });

// Texto do documento — últimas 40 linhas
const xml = zip.file("word/document.xml").asText();
const linhas = xml.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").split("\n")
  .map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

console.log("\n=== Últimas 40 linhas do documento ===");
linhas.slice(-40).forEach(function(l, i) {
  console.log("[" + (linhas.length - 40 + i) + "] " + l.substring(0, 200));
});

// Rodapé
["word/footer1.xml","word/footer2.xml","word/footer3.xml"].forEach(function(f) {
  if (norm[f]) {
    const fxml = norm[f].asText();
    const ftxt = fxml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log("\n=== " + f + " ===\n" + ftxt.substring(0, 500));
  }
});

// Cabeçalho
["word/header1.xml","word/header2.xml","word/header3.xml"].forEach(function(f) {
  if (norm[f]) {
    const hxml = norm[f].asText();
    const htxt = hxml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log("\n=== " + f + " ===\n" + htxt.substring(0, 300));
  }
});
