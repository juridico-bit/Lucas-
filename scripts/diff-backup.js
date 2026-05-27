"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

function readXml(path) {
  const buf = fs.readFileSync(path);
  const zip = new PizZip(buf);
  const norm = {};
  Object.keys(zip.files).forEach((k) => { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
  zip.files = norm;
  return zip.file("word/document.xml").asText();
}

const novo = readXml("templates/voo-internacional-multi-autor.docx");
const bak  = readXml("templates/voo-internacional-multi-autor.docx.bak");

console.log("Novo XML length:", novo.length);
console.log("Bak  XML length:", bak.length);
console.log("Identicos:", novo === bak);

if (novo !== bak) {
  // Find first difference
  let i = 0;
  while (i < novo.length && i < bak.length && novo[i] === bak[i]) i++;
  console.log("Primeira diferença no índice:", i);
  console.log("NOVO:", JSON.stringify(novo.substring(Math.max(0,i-80), i+120)));
  console.log("BAK: ", JSON.stringify(bak.substring(Math.max(0,i-80), i+120)));
}
