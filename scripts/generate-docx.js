// Standalone Node.js script for docx generation — runs outside Next.js webpack bundle
// Receives JSON on stdin, writes docx ArrayBuffer to stdout as base64
"use strict";
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const { templatePath, placeholders } = JSON.parse(raw);

    if (!existsSync(templatePath)) {
      process.stderr.write(JSON.stringify({ error: `Template não encontrado: ${templatePath} | cwd=${process.cwd()}` }));
      process.exit(1);
    }

    const content = readFileSync(templatePath);
    // Verify it's a valid ZIP by checking magic bytes
    const magic = content.slice(0, 4);
    if (magic[0] !== 0x50 || magic[1] !== 0x4B) {
      process.stderr.write(JSON.stringify({ error: `Arquivo não é um ZIP válido. Primeiros bytes: ${Array.from(magic.slice(0,4)).join(',')} | size=${content.length}` }));
      process.exit(1);
    }
    const zip = new PizZip(content);

    // Fix: No Windows o PizZip usa barras invertidas (word\document.xml) mas
    // o docxtemplater procura com barras normais (word/document.xml).
    // Normalizamos todos os caminhos para usar barra normal.
    const rawFiles = zip.files;
    const normalizedFiles = {};
    Object.keys(rawFiles).forEach((key) => {
      const normalKey = key.replace(/\\/g, "/");
      normalizedFiles[normalKey] = rawFiles[key];
    });
    zip.files = normalizedFiles;

    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    // Pré-processamento defensivo dos placeholders de texto puro:
    // 1. Remove qualquer XML/HTML residual que o modelo possa ter emitido
    // 2. Remove marcadores **negrito** e *itálico*
    // 3. Adiciona recuo de primeira linha (4 NBSP) nos campos de narrativa
    const INDENT_FIELDS = ['RELATO', 'DESC_COMPROMISSO', 'DESC_COMPROMISSO_DETALHE'];
    const INDENT = '    ';
    const cleanedPlaceholders = {};
    Object.keys(placeholders).forEach((key) => {
      const val = placeholders[key];
      // Campos raw OOXML (chave com ~): remove o ~ prefix para que docxtemplater
      // encontre a chave correta ao processar {~PLACEHOLDER} no template.
      // Ex: rota envia "~DESC_COMPROMISSO" → cleanedPlaceholders["DESC_COMPROMISSO"] = ooxml
      if (key.startsWith('~')) {
        cleanedPlaceholders[key.slice(1)] = val;
        return;
      }
      if (typeof val !== 'string') {
        // null/undefined → string vazia para evitar que docxtemplater renderize "undefined" ou "null"
        // Booleanos e números são passados intactos (usados em condicionais {#tem_gastos})
        cleanedPlaceholders[key] = (val === null || val === undefined) ? '' : val;
        return;
      }
      let v = val
        .replace(/<[^>]+>/g, ' ')          // strip XML/HTML tags
        .replace(/\*\*(.*?)\*\*/g, '$1')   // strip **negrito**
        .replace(/\*(.*?)\*/g, '$1')       // strip *itálico*
        .replace(/[^\S\n]+/g, ' ')         // normaliza espaços horizontais
        .replace(/\n{3,}/g, '\n\n')        // máx 2 quebras consecutivas
        .trim();
      if (INDENT_FIELDS.includes(key) && v) {
        v = v
          .split('\n\n')
          .map((para) => (para.trim() ? INDENT + para.trim() : ''))
          .join('\n\n');
      }
      cleanedPlaceholders[key] = v;
    });

    doc.render(cleanedPlaceholders);
    const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    process.stdout.write(buf.toString("base64"));
  } catch (e) {
    // Expõe os erros detalhados do docxtemplater (multi-error tem propriedade .properties.errors)
    let detail = e.message;
    if (e.properties && Array.isArray(e.properties.errors) && e.properties.errors.length > 0) {
      detail = e.properties.errors
        .map((err) => {
          const tag = err.properties && err.properties.tag ? err.properties.tag : '?';
          const msg = err.message || (err.properties && err.properties.explanation) || JSON.stringify(err.properties);
          return `[${tag}] ${msg}`;
        })
        .join(' | ');
    }
    process.stderr.write(JSON.stringify({ error: detail }));
    process.exit(1);
  }
});
