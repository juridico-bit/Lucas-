import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

/**
 * Resolve a ANTHROPIC_API_KEY com fallback para .env.local.
 *
 * Problema: o Claude Code CLI injeta ANTHROPIC_API_KEY="" (vazia) no ambiente.
 * O Next.js respeita variáveis de sistema acima do .env.local, então process.env
 * recebe string vazia e o SDK falha com "Could not resolve authentication method".
 *
 * Solução: se a variável estiver vazia, lê .env.local diretamente.
 */
function resolveApiKey(): string | undefined {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();

  // Fallback: lê .env.local diretamente
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (match && match[1].trim()) return match[1].trim();
  } catch {
    // .env.local não encontrado — deixa o SDK lidar com o erro
  }
  return undefined;
}

export function createAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: resolveApiKey() });
}
