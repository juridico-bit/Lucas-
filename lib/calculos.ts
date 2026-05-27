import { differenceInMinutes, parse, isValid, addMinutes, format } from "date-fns";

/** Tenta parsear datetime em "dd/MM/yyyy HH:mm". Retorna null se inválido. */
function parseDataHora(s: string): Date | null {
  if (!s) return null;
  const d = parse(s.trim(), "dd/MM/yyyy HH:mm", new Date());
  return isValid(d) ? d : null;
}

export function calcularAtraso(
  chegadaPrevista: string,
  chegadaReal: string
): { texto: string; simples: string } {
  if (!chegadaPrevista || !chegadaReal) return { texto: "", simples: "" };

  try {
    const prevista = parseDataHora(chegadaPrevista);
    const real     = parseDataHora(chegadaReal);

    // Se qualquer data for inválida (ex: só "HH:MM" sem data), não mostra NaN
    if (!prevista || !real) return { texto: "", simples: "" };

    const diffMin = differenceInMinutes(real, prevista);

    if (diffMin <= 0) return { texto: "0 horas e 0 minutos", simples: "0h" };

    const horas   = Math.floor(diffMin / 60);
    const minutos = diffMin % 60;

    const texto  = minutos > 0
      ? `${horas} ${horas === 1 ? "hora" : "horas"} e ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`
      : `${horas} ${horas === 1 ? "hora" : "horas"}`;
    const simples = `${horas}h${minutos > 0 ? `${minutos}min` : ""}`;

    return { texto, simples };
  } catch {
    return { texto: "", simples: "" };
  }
}

export function diaDaSemana(data: string): string {
  if (!data) return "";
  try {
    const d = parse(data, "dd/MM/yyyy", new Date());
    if (!isValid(d)) return "";
    const dias = [
      "domingo", "segunda-feira", "terça-feira", "quarta-feira",
      "quinta-feira", "sexta-feira", "sábado",
    ];
    return dias[d.getDay()];
  } catch {
    return "";
  }
}

export function dataAtual(): string {
  const hoje = new Date();
  return `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
}

/** Retorna a diferença em minutos entre chegada prevista e real (0 se inválido). */
export function calcularAtrasoMinutos(chegadaPrevista: string, chegadaReal: string): number {
  if (!chegadaPrevista || !chegadaReal) return 0;
  try {
    const prevista = parseDataHora(chegadaPrevista);
    const real     = parseDataHora(chegadaReal);
    if (!prevista || !real) return 0;
    const diff = differenceInMinutes(real, prevista);
    // diff pode ser NaN se alguma data for inválida — tratar explicitamente
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

// ─── Tabela de duração de voo entre aeroportos brasileiros ────────────────────
// Cada entrada: [origem, destino, minutos]. A chave é normalizada (ordenada)
// pela função duracaoVooBR(), então a ordem de origem/destino não importa aqui.
const ROTAS_BR: [string, string, number][] = [
  // SP (GRU / CGH / VCP) ↔ outros
  ["GRU", "SDU", 65], ["GRU", "GIG", 65],
  ["GRU", "BSB", 95], ["CGH", "BSB", 90],
  ["GRU", "CNF", 75], ["CGH", "CNF", 70],
  ["GRU", "CWB", 65], ["CGH", "CWB", 65],
  ["GRU", "FLN", 80], ["CGH", "FLN", 75],
  ["GRU", "FOR", 185], ["CGH", "FOR", 185],
  ["GRU", "SSA", 155], ["CGH", "SSA", 155],
  ["GRU", "REC", 170], ["CGH", "REC", 170],
  ["GRU", "POA", 95],  ["CGH", "POA", 95],
  ["GRU", "MAO", 255], ["CGH", "MAO", 255],
  ["GRU", "BEL", 215], ["CGH", "BEL", 215],
  ["GRU", "NAT", 200], ["CGH", "NAT", 200],
  ["GRU", "MCZ", 175], ["CGH", "MCZ", 175],
  ["GRU", "SLZ", 200], ["CGH", "SLZ", 200],
  ["GRU", "IGU", 90],  ["CGH", "IGU", 90],
  ["GRU", "CGB", 125], ["CGH", "CGB", 120],
  ["GRU", "CGR", 95],  ["CGH", "CGR", 90],
  ["GRU", "JPA", 200], ["CGH", "JPA", 200],
  ["GRU", "THE", 205], ["CGH", "THE", 205],
  ["GRU", "PMW", 130], ["CGH", "PMW", 130],
  ["GRU", "AJU", 165], ["CGH", "AJU", 160],
  ["GRU", "VCP", 30],
  ["CGH", "SDU", 65],  ["CGH", "GIG", 65],
  // RJ (GIG / SDU) ↔ outros
  ["GIG", "SDU", 20],
  ["GIG", "BSB", 95],  ["SDU", "BSB", 95],
  ["GIG", "CNF", 50],  ["SDU", "CNF", 50],
  ["GIG", "CWB", 90],  ["SDU", "CWB", 90],
  ["GIG", "FLN", 90],  ["SDU", "FLN", 90],
  ["GIG", "FOR", 200], ["SDU", "FOR", 200],
  ["GIG", "SSA", 155], ["SDU", "SSA", 155],
  ["GIG", "REC", 155], ["SDU", "REC", 155],
  ["GIG", "POA", 125], ["SDU", "POA", 125],
  ["GIG", "MAO", 255], ["SDU", "MAO", 255],
  ["GIG", "BEL", 215], ["SDU", "BEL", 215],
  // BSB ↔ outros
  ["BSB", "CNF", 60],  ["BSB", "CWB", 95],
  ["BSB", "FLN", 110], ["BSB", "FOR", 155],
  ["BSB", "SSA", 110], ["BSB", "REC", 140],
  ["BSB", "MAO", 180], ["BSB", "BEL", 135],
  ["BSB", "NAT", 155], ["BSB", "MCZ", 150],
  ["BSB", "SLZ", 135], ["BSB", "IGU", 115],
  ["BSB", "CGB", 90],  ["BSB", "CGR", 95],
  ["BSB", "JPA", 160], ["BSB", "THE", 155],
  ["BSB", "PMW", 65],  ["BSB", "POA", 120],
  ["BSB", "AJU", 115],
  // Sul ↔ Sul
  ["CWB", "FLN", 45],  ["CWB", "IGU", 45],
  ["CWB", "POA", 60],  ["FLN", "POA", 50],
  ["FLN", "IGU", 60],  ["IGU", "POA", 75],
  // CNF ↔ outros
  ["CNF", "SSA", 110], ["CNF", "REC", 130],
  ["CNF", "FOR", 175], ["CNF", "POA", 100],
  ["CNF", "CWB", 65],  ["CNF", "FLN", 85],
  // Nordeste interno
  ["FOR", "NAT", 50],  ["FOR", "REC", 65],
  ["FOR", "SLZ", 90],  ["FOR", "SSA", 125],
  ["FOR", "JPA", 55],  ["FOR", "MCZ", 90],
  ["FOR", "MAO", 185],
  ["BEL", "FOR", 120], ["BEL", "SSA", 185],
  ["BEL", "SLZ", 90],  ["BEL", "NAT", 155],
  ["BEL", "REC", 170],
  ["MCZ", "REC", 50],  ["MCZ", "SSA", 60],
  ["MCZ", "NAT", 65],
  ["JPA", "NAT", 30],  ["JPA", "REC", 35],
  ["AJU", "SSA", 45],  ["AJU", "REC", 65],
  ["REC", "SLZ", 120], ["NAT", "SLZ", 100],
  // Norte
  ["BEL", "MAO", 120], ["MAO", "PVH", 90],
  ["BVB", "MAO", 70],  ["MAO", "MCP", 100],
  ["BEL", "MCP", 90],  ["BEL", "STM", 75],
  // Centro-Oeste
  ["CGB", "CGR", 60],  ["CGR", "PMW", 65],
  ["CGB", "PMW", 60],
];

const DURACAO_VOO_BR: Record<string, number> = Object.fromEntries(
  ROTAS_BR.map(([o, d, min]) => {
    const chave = o < d ? `${o}-${d}` : `${d}-${o}`;
    return [chave, min];
  })
);

/**
 * Retorna a duração estimada de voo em minutos entre dois aeroportos brasileiros.
 * Retorna null se o par não estiver na tabela.
 */
export function duracaoVooBR(origem: string, destino: string): number | null {
  if (!origem || !destino) return null;
  const o = origem.toUpperCase().trim();
  const d = destino.toUpperCase().trim();
  if (o === d) return 0;
  const chave = o < d ? `${o}-${d}` : `${d}-${o}`;
  return DURACAO_VOO_BR[chave] ?? null;
}

/**
 * Estima a chegada prevista somando a duração de voo à hora de partida.
 * Retorna string "DD/MM/AAAA HH:MM" ou "" se não for possível calcular.
 */
export function estimarChegadaPrevista(
  dataVoo: string,
  partida: string,
  origem: string,
  destino: string
): string {
  if (!dataVoo || !partida || !origem || !destino) return "";
  const duracao = duracaoVooBR(origem, destino);
  if (duracao === null) return "";
  try {
    const dt = parse(`${dataVoo} ${partida}`, "dd/MM/yyyy HH:mm", new Date());
    if (!isValid(dt)) return "";
    const chegada = addMinutes(dt, duracao);
    return format(chegada, "dd/MM/yyyy HH:mm");
  } catch {
    return "";
  }
}

/**
 * Sugere um valor de danos morais com base no atraso e demais fatores.
 * Retorna "" se atraso < 4h (escritório não atua nesses casos) ou se inválido.
 *
 * Tabela base (apenas atrasos ≥ 4h):
 *   4–6 h  → R$  7.000
 *  6–12 h  → R$ 10.000
 * 12–24 h  → R$ 12.000
 *  > 24 h  → R$ 15.000
 *
 * Acréscimos automáticos:
 *  +R$ 1.000 se perda de compromisso (profissional ou pessoal)
 *  +R$ 1.000 se situação de vulnerabilidade (idoso, condição especial, gestante ou bebê de colo)
 */
export function sugerirValorMorais(
  atrasoMinutos: number,
  perdaCompromisso?: string,
  vulneravel?: boolean,
  recebeHospedagem?: boolean
): string {
  // Guarda contra NaN, Infinity; não atuamos em atrasos < 4h
  if (!Number.isFinite(atrasoMinutos) || atrasoMinutos < 240) return "";

  let base = 0;
  if      (atrasoMinutos < 360)  base = 6500;   // 4–6h
  else if (atrasoMinutos < 480)  base = 7000;   // 6–8h
  else if (atrasoMinutos < 720)  base = 7500;   // 8–12h
  else if (atrasoMinutos < 960)  base = 8500;   // 12–16h
  else if (atrasoMinutos < 1440) base = 12000;  // 16–24h
  else if (atrasoMinutos < 2880) base = 15000;  // >24h ≤ 48h
  else                            base = 20000;  // >48h

  if (perdaCompromisso === "profissional" || perdaCompromisso === "pessoal") base += 1000;
  if (vulneravel) base += 1000;
  if (recebeHospedagem) base -= 1000;

  return base.toFixed(2);
}
