export interface DadosVoo {
  numero: string;
  origem_cidade: string;
  origem_sigla: string;
  destino_cidade: string;
  destino_sigla: string;
  data: string;
  dia_semana: string;
  partida: string;
  chegada: string;
}

export interface DadosVooRealocacao {
  numero: string;
  origem_cidade: string;
  destino_cidade: string;
  data: string;
  dia_semana: string;
  partida: string;
  chegada: string;
}

export interface GastoExtra {
  categoria: string;
  descricao?: string;
  valor: string;
}

export interface DadosFormulario {
  // Template
  template: string;

  // Autores
  num_autores: number;
  autores: Array<{
    nome: string;
    qualificacao: string;
    cpf: string;
    rg: string;
    email: string;
    endereco: string;
    data_nascimento: string;
    idoso: boolean;
  }>;

  // Réu
  companhia: string;

  // Voo
  tipo_rota: "direto" | "conexao" | "2conexoes";
  voos: DadosVoo[];
  voo_realocacao: DadosVooRealocacao;
  chegada_prevista: string;
  chegada_real: string;
  tempo_atraso: string;
  tempo_atraso_simples: string;

  // Assistência
  assistencia: string[];
  perda_compromisso: "profissional" | "pessoal" | "nao";
  desc_compromisso: string;
  desc_compromisso_detalhe: string;
  gestante_bebe: "gestante" | "bebe" | "nao";
  condicao_especial: boolean; // autismo, deficiência, doença — acréscimo de vulnerabilidade
  recebeu_hospedagem: boolean; // recebeu auxílio hospedagem da companhia — redução de R$ 1.000

  // Gastos
  tem_gastos: boolean;
  gastos: GastoExtra[];
  valor_morais: string;
  valor_morais_extenso: string;
  valor_alimentacao: string;
  valor_passagem: string;

  // Relato
  relato: string;
  particularidade: string;

  // Processual
  id_caso?: string;
  data_peticao: string;
  observacoes_internas?: string;
}

export interface HistoricoItem {
  id: string;
  modulo: string;
  autor: string;
  companhia: string;
  data_geracao: string;
  dados: Partial<DadosFormulario>;
  /** Tempo de extração de documentos em milissegundos (coletado a partir de 27/05/2025) */
  tempo_extracao_ms?: number;
}

/** Nível de confiança da IA por campo extraído */
export type NivelConfianca = "alta" | "media" | "baixa";

/**
 * Mapa campo → confiança para os campos preenchidos pela IA.
 * Chaves usam o mesmo formato de camposIA: "companhia", "voos.0.numero", etc.
 */
export type ConfiancaExtracao = Record<string, NivelConfianca>;

export interface DadosExtraidos {
  companhia: string;
  tipo_rota: string;
  confiancas?: ConfiancaExtracao;
  voos: Array<{
    numero: string;
    origem_cidade: string;
    origem_sigla: string;
    destino_cidade: string;
    destino_sigla: string;
    data: string;
    dia_semana: string;
    partida: string;
    chegada: string;
  }>;
  voo_realocacao: {
    numero: string;
    origem_cidade: string;
    destino_cidade: string;
    data: string;
    dia_semana: string;
    partida: string;
    chegada: string;
  };
  chegada_prevista: string;
  chegada_real: string;
  gastos: Array<{ categoria: string; valor: string }>;
  relato: string;
  compromisso_perdido: string;
  compromisso_detalhe: string;
}
