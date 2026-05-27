"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

function readDocxXml(path) {
  const buf = fs.readFileSync(path);
  const zip = new PizZip(buf);
  const norm = {};
  Object.keys(zip.files).forEach((k) => { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
  zip.files = norm;
  return zip.file("word/document.xml").asText();
}

const srcPath = "C:/Users/lucas/OneDrive/Área de Trabalho/voo-internacional-multi-autor.docx";
const dstPath = "templates/voo-internacional-multi-autor.docx";

const srcXml = readDocxXml(srcPath);
const dstXml = readDocxXml(dstPath);

console.log("src XML length:", srcXml.length);
console.log("dst XML length:", dstXml.length);
console.log("Are identical:", srcXml === dstXml);

if (srcXml !== dstXml) {
  // Find first difference
  let diffIdx = 0;
  while (diffIdx < srcXml.length && diffIdx < dstXml.length && srcXml[diffIdx] === dstXml[diffIdx]) {
    diffIdx++;
  }
  console.log("First difference at index:", diffIdx);
  console.log("SRC around diff:", JSON.stringify(srcXml.substring(Math.max(0, diffIdx-50), diffIdx+100)));
  console.log("DST around diff:", JSON.stringify(dstXml.substring(Math.max(0, diffIdx-50), diffIdx+100)));
} else {
  console.log("Files are IDENTICAL — the copy was successful.");
}

// Check key placeholders in destination
const placeholders = ["{NOME_AUTOR1}", "{NOME_AUTOR2}", "{RELATO}", "{VALOR_MORAIS_POR_AUTOR}", "{VALOR_PASSAGEM}"];
console.log("\n--- Placeholder presence in DST ---");
placeholders.forEach(p => {
  console.log(p, ":", dstXml.includes(p));
});
