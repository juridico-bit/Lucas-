"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

const path = process.argv[2] || "templates/voo-internacional-multi-autor.docx";
const buf = fs.readFileSync(path);
const zip = new PizZip(buf);
const norm = {};
Object.keys(zip.files).forEach((k) => { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
zip.files = norm;

const xml = zip.file("word/document.xml").asText();

// Extract readable text (strip XML tags)
const readable = xml
  .replace(/<w:br[^/]*/g, "\n")
  .replace(/<\/w:p>/g, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

// Print first 3000 chars to understand structure
console.log("=== TEMPLATE TEXT (first 4000 chars) ===");
console.log(readable.substring(0, 4000));
console.log("\n=== TEMPLATE TEXT (last 2000 chars) ===");
console.log(readable.substring(readable.length - 2000));
