export type CompanhiaKey = "LATAM" | "GOL" | "AZUL";

export type CompanhiaInternacionalKey =
  | "LATAM" | "GOL" | "AZUL"
  | "AIR_FRANCE" | "KLM" | "TAP" | "AMERICAN" | "UNITED" | "EMIRATES" | "IBERIA" | "ITA";

export interface Companhia {
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  endereco: string;
  comarca: string;
  email: string;
  telefone: string;
}

// ── Companhias nacionais ───────────────────────────────────────────────────────
export const COMPANIAS: Record<CompanhiaKey, Companhia> = {
  LATAM: {
    nome_fantasia: "Latam Airlines",
    razao_social: "Latam Airlines Group S/A",
    cnpj: "33.937.681/0001-78",
    endereco: "Rua Ática, nº 673, Sala 5001, Jardim Brasil, São Paulo/SP, CEP 04.634-042",
    comarca: "Foro de Jabaquara da Comarca de São Paulo/SP",
    email: "fiscal@tam.com.br",
    telefone: "(11) 5582-7222 / (11) 5582-7364",
  },
  GOL: {
    nome_fantasia: "GOL Linhas Aéreas",
    razao_social: "GOL Linhas Aéreas S/A",
    cnpj: "07.575.651/0001-59",
    endereco:
      "Praça Senador Salgado Filho, S/N, Térreo, Sala de Gerência Back Office, Centro, Rio de Janeiro/RJ, CEP 20.021-340",
    comarca: "Foro de Jabaquara da Comarca de São Paulo/SP",
    email: "",
    telefone: "",
  },
  AZUL: {
    nome_fantasia: "Azul Linhas Aéreas",
    razao_social: "Azul Linhas Aéreas Brasileiras S/A",
    cnpj: "09.296.295/0001-60",
    endereco:
      "Av. Marcos Penteado de Ulhôa Rodrigues, nº 939, 9º andar, Torre Jatobá, Condomínio Castelo Branco Office Park, Tamboré, Barueri/SP, CEP 06.460-040",
    comarca: "Comarca de Barueri/SP",
    email: "",
    telefone: "",
  },
};

// ── Companhias internacionais ─────────────────────────────────────────────────
export const COMPANIAS_INTERNACIONAL: Record<CompanhiaInternacionalKey, Companhia> = {
  // Nacionais (também operam rotas internacionais)
  LATAM: COMPANIAS.LATAM,
  GOL:   COMPANIAS.GOL,
  AZUL:  COMPANIAS.AZUL,

  AIR_FRANCE: {
    nome_fantasia: "Air France",
    razao_social: "Société Air France",
    cnpj: "33.013.988/0001-82",
    endereco:
      "Avenida Chedid Jafet, 222, Bloco B, Conj. 21, Vila Olímpia, São Paulo/SP, CEP 04.551-065",
    comarca: "Foro Regional de Pinheiros da Comarca de São Paulo/SP",
    email: "",
    telefone: "",
  },

  KLM: {
    nome_fantasia: "KLM Royal Dutch Airlines",
    razao_social: "KLM Cia. Real Holandesa de Aviação",
    cnpj: "33.643.420/0001-45",
    endereco:
      "Avenida Chedid Jafet, 222, Bloco B, Conj. 21, Vila Olímpia, São Paulo/SP, CEP 04.551-065",
    comarca: "Foro Regional de Pinheiros da Comarca de São Paulo/SP",
    email: "",
    telefone: "",
  },

  TAP: {
    nome_fantasia: "TAP Air Portugal",
    razao_social: "Transportes Aéreos Portugueses S.A.",
    cnpj: "33.136.896/0001-90",
    endereco:
      "Avenida Paulista, 453, Andar 14, Bela Vista, São Paulo/SP, CEP 01.311-000",
    comarca: "Foro Central Cível da Comarca de São Paulo/SP",
    email: "",
    telefone: "",
  },

  AMERICAN: {
    nome_fantasia: "American Airlines",
    razao_social: "American Airlines Inc.",
    cnpj: "36.212.637/0001-99",
    endereco:
      "Rua Doutor Fernandes Coelho, 64, Andares 7 ao 9, Pinheiros, São Paulo/SP, CEP 05.423-040",
    comarca: "Foro Regional de Pinheiros da Comarca de São Paulo/SP",
    email: "",
    telefone: "",
  },

  UNITED: {
    nome_fantasia: "United Airlines",
    razao_social: "United Airlines, Inc.",
    cnpj: "01.526.415/0001-66",
    endereco:
      "Avenida Paulista, 777, Conj. 81, 82, 91 e 92, Cerqueira César, São Paulo/SP, CEP 01.311-100",
    comarca: "Foro Central Cível da Comarca de São Paulo/SP",
    email: "",
    telefone: "",
  },

  EMIRATES: {
    nome_fantasia: "Emirates",
    razao_social: "Emirates",
    cnpj: "08.692.080/0001-03",
    endereco:
      "Rua James Joule, 92, 7º andar, Conjuntos 71 e 72, Cidade Monções, São Paulo/SP, CEP 04.576-080",
    comarca: "Foro Regional de Santo Amaro da Comarca de São Paulo/SP",
    email: "",
    telefone: "",
  },

  IBERIA: {
    nome_fantasia: "Iberia",
    razao_social: "Iberia Líneas Aéreas de España Sociedad Anónima Operadora",
    cnpj: "13.115.840/0001-41",
    endereco:
      "Rua Haddock Lobo, 337, Conj. 71, Cerqueira César, São Paulo/SP, CEP 01.414-901",
    comarca: "Foro Central Cível da Comarca de São Paulo/SP",
    email: "",
    telefone: "",
  },

  ITA: {
    nome_fantasia: "ITA Airways",
    razao_social: "Italia Transporto Aereo S.P.A.",
    cnpj: "45.153.382/0001-21",
    endereco:
      "Rua Vieira de Morais, nº 1111, Conjunto 302, Campo Belo, São Paulo/SP, CEP 04.617-014",
    comarca: "Foro Regional I de Santana da Comarca de São Paulo/SP",
    email: "",
    telefone: "",
  },
};
