"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

const TEMPLATE = "templates/voo-internacional-multi-autor.docx";
const buf = fs.readFileSync(TEMPLATE);
const zip = new PizZip(buf);
const norm = {};
Object.keys(zip.files).forEach(function(k) { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
zip.files = norm;

let xml = zip.file("word/document.xml").asText();

// PROBLEMA: o run "<w:t>sp}{</w:t>" está no meio de dois tags docxtemplater distintos:
// - {/autor_em_sp} (fecha o bloco autor_em_sp)
// - {#autor_fora_sp} (abre o bloco autor_fora_sp)
// O docxtemplater não consegue dividir um único run entre dois tags.
// SOLUÇÃO: separar "sp}{" em dois runs independentes: "sp}" e "{"

const idx = xml.indexOf("sp}{");
if (idx === -1) {
  console.log("SKIP: 'sp}{' not found — template may already be patched.");
  process.exit(0);
}

// Localiza o run completo que contém "sp}{"
// Volta até o <w:r> pai
const runStart = xml.lastIndexOf("<w:r>", idx);
// Avança até </w:r>
const runEnd = xml.indexOf("</w:r>", idx) + "</w:r>".length;

const runXml = xml.substring(runStart, runEnd);
console.log("Run encontrado:", runXml);

// Extrai o <w:rPr> para clonar nos dois novos runs
const rPrMatch = runXml.match(/(<w:rPr>[\s\S]*?<\/w:rPr>)/);
const rPr = rPrMatch ? rPrMatch[1] : "";

// Monta dois novos runs: um com "sp}" e outro com "{"
const newRuns =
  "<w:r>" + rPr + '<w:t>sp}</w:t></w:r>' +
  "<w:r>" + rPr + '<w:t>{</w:t></w:r>';

// Verifica se há <w:proofErr> antes/depois do run e remove (são hints do spell-checker, não funcionais)
// Pega contexto para remover os proofErr
let before = xml.substring(0, runStart);
let after  = xml.substring(runEnd);

// Remove <w:proofErr w:type="gramStart"/> imediatamente antes do run
before = before.replace(/<w:proofErr w:type="gramStart"\/>$/, "");
// Remove <w:proofErr w:type="gramEnd"/> imediatamente após o run
after  = after.replace(/^<w:proofErr w:type="gramEnd"\/>/, "");

xml = before + newRuns + after;

// Verifica
console.log("sp}{ still present:", xml.includes("sp}{"));
console.log("{#autor_em_sp}:", xml.includes("{#autor_em_sp}"));
console.log("{/autor_em_sp}:", xml.includes("{/autor_em_sp}") || (xml.includes("{/autor_em_") && xml.includes("sp}")));
console.log("{#autor_fora_sp}:", xml.includes("{#autor_fora_sp}") || (xml.includes("{") && xml.includes("#autor_fora_sp}")));
console.log("{/autor_fora_sp}:", xml.includes("{/autor_fora_sp}"));

// Salva
zip.file("word/document.xml", xml);
const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync(TEMPLATE, out);
fs.writeFileSync("templates/voo-internacional-multi-autor-novo.docx", out);
console.log("Template patched. Size:", out.length);
