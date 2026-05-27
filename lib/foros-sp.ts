/**
 * Tabela de Foros Regionais de São Paulo Capital (TJSP)
 * Fonte: https://www.tjsp.jus.br/app/CompetenciaTerritorial
 *
 * Quando o autor residir em São Paulo Capital, o foro competente é o do
 * domicílio do autor (CDC, art. 101, I), não o da sede da companhia ré.
 */

export interface ForoSP {
  foroDescricao: string; // usado em {FORO_DESCRICAO} no template
  comarca: string;       // sempre "São Paulo/SP"
}

/**
 * Tabela: [cepInicio5dig, cepFim5dig, foroDescricao]
 * Os valores são os 5 primeiros dígitos do CEP como inteiro.
 * Ex.: CEP 04530-001 → prefixo 4530.
 * Fonte: TJSP — 50 faixas de CEP cobrindo toda SP Capital.
 */
const TABELA: Array<[number, number, string]> = [
  // ── Centro ──────────────────────────────────────────────────────────────
  [1000, 1099, "Foro Central João Mendes Jr."],
  [1100, 1199, "Foro Central João Mendes Jr."],
  [1200, 1299, "Foro Central João Mendes Jr."],
  [1300, 1399, "Foro Central João Mendes Jr."],
  [1400, 1499, "Foro Regional XI de Pinheiros"],   // Jardins, Cerqueira César
  [1500, 1599, "Foro Central João Mendes Jr."],
  // ── Norte – Santana ─────────────────────────────────────────────────────
  [2000, 2099, "Foro Regional I de Santana"],
  [2100, 2199, "Foro Regional I de Santana"],
  [2200, 2299, "Foro Regional I de Santana"],
  [2300, 2399, "Foro Regional I de Santana"],
  [2400, 2499, "Foro Regional I de Santana"],
  // ── Norte – Nossa Senhora do Ó ──────────────────────────────────────────
  [2500, 2599, "Foro Regional XII de Nossa Senhora do Ó"],
  [2600, 2699, "Foro Regional XII de Nossa Senhora do Ó"],
  [2700, 2799, "Foro Regional XII de Nossa Senhora do Ó"],
  [2800, 2899, "Foro Regional XII de Nossa Senhora do Ó"],
  [2900, 2999, "Foro Regional XII de Nossa Senhora do Ó"],
  // ── Leste – Tatuapé / Vila Prudente / Penha ─────────────────────────────
  [3000, 3099, "Foro Regional VIII do Tatuapé"],
  [3100, 3199, "Foro Regional VIII do Tatuapé"],
  [3200, 3299, "Foro Regional IX de Vila Prudente"],
  [3300, 3399, "Foro Regional VIII do Tatuapé"],
  [3400, 3499, "Foro Regional VIII do Tatuapé"],
  [3500, 3599, "Foro Regional VI de Penha de França"],
  [3600, 3699, "Foro Regional VI de Penha de França"],
  [3700, 3799, "Foro Regional VI de Penha de França"],
  [3800, 3899, "Foro Regional VI de Penha de França"],
  [3900, 3999, "Foro Regional XIV de São Mateus"],
  // ── Sul ─────────────────────────────────────────────────────────────────
  [4000, 4099, "Foro Regional II de Santo Amaro"],
  [4100, 4199, "Foro Regional II de Santo Amaro"],
  [4200, 4299, "Foro Regional X do Ipiranga"],
  [4300, 4399, "Foro Regional III do Jabaquara"],
  [4400, 4499, "Foro Regional II de Santo Amaro"],
  [4500, 4599, "Foro Regional XI de Pinheiros"],   // Itaim Bibi, Brooklin
  [4600, 4699, "Foro Regional II de Santo Amaro"],
  [4700, 4799, "Foro Regional II de Santo Amaro"],
  [4800, 4899, "Foro Regional II de Santo Amaro"],
  [4900, 4999, "Foro Regional II de Santo Amaro"],
  // ── Oeste – Lapa / Butantã / Pinheiros ──────────────────────────────────
  [5000, 5099, "Foro Regional IV da Lapa"],
  [5100, 5199, "Foro Regional IV da Lapa"],
  [5200, 5299, "Foro Regional IV da Lapa"],
  [5300, 5399, "Foro Regional XIII do Butantã"],
  // IMPORTANTE: 5400-5449 = Pinheiros / Vila Madalena / Alto de Pinheiros
  //             5450-5499 = Alto da Lapa / Lapa (confirmado TJSP: CEP 05455-040 → Foro LAPA)
  [5400, 5449, "Foro Regional XI de Pinheiros"],   // Pinheiros, Vila Madalena, Alto de Pinheiros
  [5450, 5499, "Foro Regional IV da Lapa"],         // Alto da Lapa, Lapa — TJSP confirmado
  [5500, 5599, "Foro Regional XIII do Butantã"],
  [5600, 5699, "Foro Regional XI de Pinheiros"],   // Morumbi, Cidade Jardim
  // ── Sul – Campo Limpo / Capão Redondo ───────────────────────────────────
  [5700, 5799, "Foro Regional II de Santo Amaro"],
  [5800, 5899, "Foro Regional II de Santo Amaro"],
  // ── Leste extremo – São Miguel / Itaquera / São Mateus ──────────────────
  [8000, 8099, "Foro Regional V de São Miguel Paulista"],
  [8100, 8199, "Foro Regional V de São Miguel Paulista"],
  [8200, 8299, "Foro Regional VII de Itaquera"],
  [8300, 8399, "Foro Regional XIV de São Mateus"],
  [8400, 8499, "Foro Regional VII de Itaquera"],
];

/**
 * Extrai o primeiro CEP encontrado em um texto (formats: 01234-567 ou 01234567).
 * Retorna os 8 dígitos sem traço, ou null se não encontrado.
 */
export function extrairCEP(texto: string): string | null {
  const m = texto.match(/\b(\d{5})-?(\d{3})\b/);
  if (!m) return null;
  return m[1] + m[2];
}

/**
 * Dado um CEP (string com ou sem traço), retorna as informações do Foro Regional
 * se o CEP pertencer a São Paulo Capital, ou null caso contrário.
 */
export function getForoByCEP(cep: string): ForoSP | null {
  const digits = cep.replace(/\D/g, "");
  if (digits.length < 5) return null;

  const prefix = parseInt(digits.substring(0, 5), 10);
  const entry = TABELA.find(([start, end]) => prefix >= start && prefix <= end);
  if (!entry) return null;

  return {
    foroDescricao: entry[2],
    comarca: "São Paulo/SP",
  };
}

/**
 * Conveniência: tenta extrair o CEP de um texto e retorna o foro, ou null.
 */
export function getForoByEndereco(endereco: string): ForoSP | null {
  const cep = extrairCEP(endereco);
  if (!cep) return null;
  return getForoByCEP(cep);
}

/**
 * Gera o texto do parágrafo de competência territorial para o placeholder
 * {TEXTO_COMPETENCIA_TERRITORIAL} nos templates.
 *
 * Quando o autor é de SP Capital, cita o CDC art. 101, I (domicílio do autor).
 * Caso contrário, cita o CPC art. 46 (domicílio do réu).
 */
export function textoCompetenciaTerritorial(foroAutor: ForoSP | null): string {
  if (foroAutor) {
    return (
      "Nestes casos a competência é relativa, aplicando-se o teor da Súmula 33 do STJ, " +
      "tendo em vista cuidar-se de prerrogativa visando à facilitação da defesa de seus direitos. " +
      `Diante disso, o juízo da presente comarca revela-se competente para a propositura dessa ação, ` +
      `optando a parte autora pela regra de competência do domicílio do consumidor, ` +
      `sendo proposta no foro do domicílio do autor (${foroAutor.foroDescricao} — ` +
      `Comarca de ${foroAutor.comarca}), nos termos do artigo 101, I do Código de Defesa do Consumidor.`
    );
  }
  return (
    "Nestes casos a competência é relativa, aplicando-se o teor da Súmula 33 do STJ, " +
    "tendo em vista cuidar-se de prerrogativa visando à facilitação da defesa de seus direitos. " +
    "Diante disso, o juízo da presente comarca revela-se competente para a propositura dessa ação, " +
    "optando a parte autora pela regra, sendo proposta no foro de domicílio do réu, " +
    "nos termos do artigo 46 do atual CPC."
  );
}
