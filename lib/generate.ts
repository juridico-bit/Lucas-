import { spawn } from "node:child_process";
import { join } from "node:path";

export function gerarDocxBuffer(
  templatePath: string,
  placeholders: Record<string, string>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const scriptPath = join(process.cwd(), "scripts", "generate-docx.js");
    const nodePath = process.execPath;

    const child = spawn(nodePath, [scriptPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const input = JSON.stringify({ templatePath, placeholders });
    child.stdin.write(input);
    child.stdin.end();

    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));

    const errChunks: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    child.on("close", (code) => {
      const errText = Buffer.concat(errChunks).toString();
      if (code !== 0) {
        try {
          const parsed = JSON.parse(errText) as { error: string };
          reject(new Error(`CHILD[${code}]: ${parsed.error}`));
        } catch {
          reject(new Error(`CHILD[${code}]: ${errText || "sem output"} | script=${scriptPath} node=${nodePath}`));
        }
        return;
      }
      const base64 = Buffer.concat(chunks).toString();
      if (!base64 || base64.length < 100) {
        reject(new Error(`CHILD output vazio ou inválido (len=${base64.length}). Stderr: ${errText}`));
        return;
      }
      resolve(Buffer.from(base64, "base64"));
    });

    child.on("error", reject);
  });
}
