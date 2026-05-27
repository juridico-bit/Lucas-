"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

const buf = fs.readFileSync("C:/Users/lucas/Downloads/TESTE-placeholder.docx");
const zip = new PizZip(buf);
const norm = {};
Object.keys(zip.files).forEach(function(k) { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
zip.files = norm;
const xml = zip.file("word/document.xml").asText();

// Placeholders não substituídos
const leftover = xml.match(/\{[~#/]?[A-Za-z_0-9]+\}/g) || [];
const unique = [...new Set(leftover)].sort();

// Texto limpo para verificar valores
const text = xml.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");

console.log("=== Placeholders NÃO substituídos: " + unique.length + " ===");
if (unique.length > 0) { console.log(unique.join("\n")); }
else { console.log("NENHUM — todos substituídos corretamente!"); }

// Verifica os 7 requeridos como valores reais no texto
var checks = [
  ["João Silva       (NOME_AUTOR1)",         text.includes("João Silva")],
  ["Maria Souza      (NOME_AUTOR2)",         text.includes("Maria Souza")],
  ["20:00            (CHEGADA_VOO1)",        text.includes("20:00")],
  ["10/05/2025       (DATA_VOO1)",           text.includes("10/05/2025")],
  ["24 horas         (TEMPO_ATRASO)",        text.includes("24 horas")],
  ["15.000,00        (VALOR_MORAIS_POR_AUTOR)", text.includes("15.000,00")],
  ["27/05/2025       (DATA_PETICAO)",        text.includes("27/05/2025")],
];
console.log("\n=== Valores substituídos corretamente ===");
checks.forEach(function(c) { console.log((c[1] ? "OK   " : "FALTA") + " " + c[0]); });
