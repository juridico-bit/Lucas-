"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

function findInTemplate(path, label) {
  const buf = fs.readFileSync(path);
  const zip = new PizZip(buf);
  const norm = {};
  Object.keys(zip.files).forEach(k => { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
  zip.files = norm;
  const xml = zip.file("word/document.xml").asText();
  // Strip tags and find competência paragraph
  const text = xml.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");
  const lines = text.split("\n").filter(l => /compet[êe]ncia|domic[íi]lio|foro|comarca|CPC|STJ|46|art/i.test(l) && l.trim().length > 10);
  console.log(`\n=== ${label} — linhas com "competência/domicílio/foro" ===`);
  lines.forEach((l, i) => console.log(`[${i}]`, l.trim().substring(0, 200)));
}

findInTemplate("templates/voo-nacional-1-autor.docx", "NACIONAL");
findInTemplate("templates/voo-internacional-multi-autor-novo.docx", "INTERNACIONAL");
