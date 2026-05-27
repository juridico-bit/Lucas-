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

const dstPath = "templates/voo-internacional-multi-autor.docx";
const xml = readDocxXml(dstPath);

// Find all {PLACEHOLDER} and {#COND} patterns
const matches = xml.match(/\{[^}]{1,60}\}/g) || [];
const unique = [...new Set(matches)].sort();
console.log("All placeholders found (" + unique.length + "):");
unique.forEach(p => console.log(" ", p));
