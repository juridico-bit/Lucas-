"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

const buf = fs.readFileSync("templates/voo-internacional-multi-autor-novo.docx");
const zip = new PizZip(buf);
const norm = {};
Object.keys(zip.files).forEach(function(k) { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
zip.files = norm;
const xml = zip.file("word/document.xml").asText();

const matches = xml.match(/\{[~#/]?[A-Za-z_0-9]+\}/g) || [];
const unique = [...new Set(matches)].sort();
console.log("Total placeholders únicos: " + unique.length);
console.log(unique.join("\n"));

const required = [
  "{NOME_AUTOR1}", "{NOME_AUTOR2}", "{CHEGADA_VOO1}", "{DATA_VOO1}",
  "{TEMPO_ATRASO}", "{VALOR_MORAIS_POR_AUTOR}", "{DATA_PETICAO}"
];
console.log("\n=== Checagem dos requeridos ===");
required.forEach(function(r) {
  console.log((xml.includes(r) ? "OK   " : "FALTA") + " " + r);
});
