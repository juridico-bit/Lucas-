"use strict";
const PizZip = require("pizzip");
const fs = require("fs");

// ── Nacional ──────────────────────────────────────────────────────────────────
(function fixNacional() {
  const buf = fs.readFileSync("templates/voo-nacional-1-autor.docx");
  const zip = new PizZip(buf);
  const norm = {};
  Object.keys(zip.files).forEach((k) => { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
  zip.files = norm;
  let xml = zip.file("word/document.xml").asText();

  // The second {NOME_AUTOR} is inside a non-bold run — split it into 3 runs
  const rPrNormal =
    '<w:rPr>' +
    '<w:rFonts w:ascii="Garamond" w:eastAsia="Garamond" w:hAnsi="Garamond" w:cs="Garamond"/>' +
    '<w:color w:val="000000"/><w:sz w:val="26"/><w:szCs w:val="26"/>' +
    '</w:rPr>';
  const rPrBold =
    '<w:rPr>' +
    '<w:rFonts w:ascii="Garamond" w:eastAsia="Garamond" w:hAnsi="Garamond" w:cs="Garamond"/>' +
    '<w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="26"/><w:szCs w:val="26"/>' +
    '</w:rPr>';

  // Find the second occurrence of {NOME_AUTOR}
  const first = xml.indexOf("{NOME_AUTOR}");
  const second = xml.indexOf("{NOME_AUTOR}", first + 1);
  if (second === -1) { console.log("Nacional: second NOME_AUTOR not found, skipping"); return; }

  // Get full run boundaries
  const rStart = xml.lastIndexOf("<w:r>", second);
  const rEnd   = xml.indexOf("</w:r>", second) + "</w:r>".length;
  const fullRun = xml.substring(rStart, rEnd);

  // Extract the text content from <w:t>
  const tMatch = fullRun.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/);
  if (!tMatch) { console.log("Nacional: could not extract run text"); return; }
  const runText = tMatch[1]; // e.g. ", {NOME_AUTOR}, Brasileiro(a)..."

  const nomeIdx = runText.indexOf("{NOME_AUTOR}");
  const before  = runText.slice(0, nomeIdx);
  const after   = runText.slice(nomeIdx + "{NOME_AUTOR}".length);

  const newRuns =
    (before ? `<w:r>${rPrNormal}<w:t xml:space="preserve">${before}</w:t></w:r>` : "") +
    `<w:r>${rPrBold}<w:t>{NOME_AUTOR}</w:t></w:r>` +
    (after  ? `<w:r>${rPrNormal}<w:t xml:space="preserve">${after}</w:t></w:r>` : "");

  xml = xml.slice(0, rStart) + newRuns + xml.slice(rEnd);
  console.log("Nacional: replaced 2nd NOME_AUTOR run — before:", JSON.stringify(before.slice(0,30)), "after:", JSON.stringify(after.slice(0,30)));

  zip.file("word/document.xml", xml);
  const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  fs.writeFileSync("templates/voo-nacional-1-autor.docx", out);
  console.log("Nacional: saved, size:", out.length);
})();

// ── Internacional ─────────────────────────────────────────────────────────────
(function fixInternacional() {
  const buf = fs.readFileSync("templates/voo-internacional-multi-autor.docx");
  const zip = new PizZip(buf);
  const norm = {};
  Object.keys(zip.files).forEach((k) => { norm[k.replace(/\\/g, "/")] = zip.files[k]; });
  zip.files = norm;
  let xml = zip.file("word/document.xml").asText();

  // Find any NOME_AUTOR* placeholders that are NOT already in bold runs
  // Check all NOME_AUTOR1..5 occurrences
  for (let n = 1; n <= 5; n++) {
    const tag = `{NOME_AUTOR${n}}`;
    let pos = 0;
    while (true) {
      const idx = xml.indexOf(tag, pos);
      if (idx === -1) break;
      // Check if bold is present within the run preceding this tag
      const rStart = xml.lastIndexOf("<w:r>", idx);
      const rEnd   = xml.indexOf("</w:r>", idx) + "</w:r>".length;
      const runXml = xml.substring(rStart, rEnd);
      const hasBold = runXml.includes("<w:b/>") || runXml.includes("<w:b ");
      if (!hasBold) {
        // Extract rPr from this run and inject bold
        const newRunXml = runXml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/, (m, inner) => {
          // Add <w:b/><w:bCs/> after the font spec
          return `<w:rPr>${inner}<w:b/><w:bCs/></w:rPr>`;
        });
        if (newRunXml !== runXml) {
          xml = xml.slice(0, rStart) + newRunXml + xml.slice(rEnd);
          console.log(`Internacional: added bold to ${tag} at ${idx}`);
        }
      } else {
        console.log(`Internacional: ${tag} already bold at ${idx}`);
      }
      pos = idx + 1;
    }
  }

  zip.file("word/document.xml", xml);
  const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  fs.writeFileSync("templates/voo-internacional-multi-autor.docx", out);
  console.log("Internacional: saved, size:", out.length);
})();

console.log("Done.");
