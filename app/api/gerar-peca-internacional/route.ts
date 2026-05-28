export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { valorPorExtenso, formatarValor } from "@/lib/extenso";
import { calcularAtraso, dataAtual } from "@/lib/calculos";
import { DadosFormulario } from "@/lib/types";
import { gerarDocxBuffer } from "@/lib/generate";
import { reescreverTerceiraPessoa, reescreverCompromisso } from "@/lib/reescrever";
import { enqueueAI } from "@/lib/ai-queue";
import { textoParaOOXML } from "@/lib/ooxml";
import { COMPANIAS_INTERNACIONAL, CompanhiaInternacionalKey } from "@/lib/companias";
import { getForoByEndereco, textoCompetenciaTerritorial } from "@/lib/foros-sp";

// Formatação Garamond 13pt — igual ao parágrafo {~DESC_COMPROMISSO} no template
const GARAMOND_RPR = '<w:rFonts w:ascii="Garamond" w:eastAsia="Garamond" w:hAnsi="Garamond" w:cs="Garamond"/><w:color w:val="000000"/><w:sz w:val="26"/><w:szCs w:val="26"/>';
const GARAMOND_PPR = '<w:pBdr><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:between w:val="nil"/></w:pBdr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/><w:ind w:firstLine="567"/><w:jc w:val="both"/>';

/** Extrai apenas a parte da data de "DD/MM/AAAA HH:MM" → "DD/MM/AAAA" */
function extrairData(dtHora: string): string {
  if (!dtHora) return "";
  const partes = dtHora.trim().split(" ");
  return partes[0] ?? "";
}

/**
 * Extrai o nome (texto antes da 1ª vírgula) e o restante da qualificação.
 * Ex: "Renato Paixão, Brasileiro, casado..." → { nome: "Renato Paixão", restoComVirgula: ", Brasileiro, casado..." }
 */
function extrairNomeDeQualificacao(qual: string): { nome: string; restoComVirgula: string } {
  const q = qual.trim();
  const idx = q.indexOf(",");
  if (idx === -1) return { nome: q, restoComVirgula: "" };
  return {
    nome: q.slice(0, idx).trim(),
    restoComVirgula: q.slice(idx), // começa com ", ..."
  };
}

/**
 * Separa "Foro Regional de Santo Amaro da Comarca de São Paulo/SP"
 * em { foro: "Foro Regional de Santo Amaro", comarca: "São Paulo/SP" }
 */
function parseForo(comarcaStr: string): { foro: string; comarca: string } {
  const sep = / da Comarca de /i;
  const idx = comarcaStr.search(sep);
  if (idx !== -1) {
    return {
      foro: comarcaStr.slice(0, idx).trim(),
      comarca: comarcaStr.slice(idx).replace(sep, "").trim(),
    };
  }
  // "Comarca de Barueri/SP" → foro vazio, comarca = cidade
  const soComarca = comarcaStr.replace(/^Comarca de /i, "").trim();
  return { foro: "", comarca: soComarca };
}

/**
 * Resolve a chave da companhia mesmo quando a IA retornou o nome fantasia.
 * Ex: "ITA Airways" → "ITA", "Air France" → "AIR_FRANCE"
 */
function resolverChaveCompanhia(
  val: string | undefined
): CompanhiaInternacionalKey | null {
  if (!val) return null;
  // Tenta chave direta
  if (val in COMPANIAS_INTERNACIONAL) return val as CompanhiaInternacionalKey;
  // Tenta por nome_fantasia (case-insensitive)
  const entrada = Object.entries(COMPANIAS_INTERNACIONAL).find(
    ([, c]) => c.nome_fantasia.toLowerCase() === val.toLowerCase()
  );
  if (entrada) return entrada[0] as CompanhiaInternacionalKey;
  // Mapa de aliases comuns retornados pela IA
  const aliases: Record<string, CompanhiaInternacionalKey> = {
    "ita":              "ITA",
    "ita airways":      "ITA",
    "italia transporto aereo": "ITA",
    "latam":            "LATAM",
    "latam airlines":   "LATAM",
    "gol":              "GOL",
    "gol linhas aereas":"GOL",
    "azul":             "AZUL",
    "azul linhas aereas":"AZUL",
    "air france":       "AIR_FRANCE",
    "klm":              "KLM",
    "klm royal dutch airlines": "KLM",
    "tap":              "TAP",
    "tap air portugal": "TAP",
    "american":         "AMERICAN",
    "american airlines":"AMERICAN",
    "united":           "UNITED",
    "united airlines":  "UNITED",
    "emirates":         "EMIRATES",
    "iberia":           "IBERIA",
  };
  return aliases[val.toLowerCase()] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { dados: DadosFormulario };
    const { dados } = body;

    // Verifica primeiro o template "novo" (override do usuario), depois o padrao
    const templatePathNovo = join(process.cwd(), "templates", "voo-internacional-multi-autor-novo.docx");
    const templatePathPadrao = join(process.cwd(), "templates", "voo-internacional-multi-autor.docx");
    const templatePath = existsSync(templatePathNovo) ? templatePathNovo : templatePathPadrao;
    if (!existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Template 'voo-internacional-multi-autor.docx' não encontrado. Faça o upload pelo painel Admin." },
        { status: 404 }
      );
    }

    // RELATO: usa o texto original do cliente sem reescrita por IA
    const relato = dados.relato ?? "";
    // DESC_COMPROMISSO usa prompt específico para perda de compromisso
    // DESC_COMPROMISSO_DETALHE usa reescrita genérica de terceira pessoa
    const [descCompromissoReescrito, descDetalheReescrito] =
      await Promise.all([
        enqueueAI(() => reescreverCompromisso(dados.desc_compromisso ?? ""), "reescrever-compromisso-int"),
        enqueueAI(() => reescreverTerceiraPessoa(dados.desc_compromisso_detalhe ?? ""), "reescrever-detalhe-int"),
      ]);

    const autores = dados.autores ?? [];
    // FIX: usa autores.length (não filtra por nome — campo nome foi removido da UI)
    const numAutores = autores.length || 1;
    const voo1 = dados.voos[0] ?? {};
    const voo2 = dados.voos[1] ?? {};
    const realoc = dados.voo_realocacao ?? {};

    // ── Valores morais ────────────────────────────────────────────────────────
    const valorMoraisPorAutor = parseFloat(dados.valor_morais || "0");
    const valorMoraisTotal = valorMoraisPorAutor * numAutores; // total = por autor × nº autores
    const valorAlimentacao = parseFloat(dados.valor_alimentacao || "0");
    const valorPassagem = parseFloat(dados.valor_passagem || "0");
    const totalMateriais = valorAlimentacao + valorPassagem;
    const totalCausa = valorMoraisTotal + totalMateriais;

    // Remove "e 0 minutos" de valores cached anteriores ao fix
    const tempoTexto = (dados.tempo_atraso ?? "").replace(/\s+e\s+0\s+minutos?/i, "").trim();
    const atraso = tempoTexto
      ? { texto: tempoTexto, simples: dados.tempo_atraso_simples }
      : calcularAtraso(dados.chegada_prevista, dados.chegada_real);

    // ── Companhia ─────────────────────────────────────────────────────────────
    const companhiaKey = resolverChaveCompanhia(dados.companhia);
    const companhiaInfo = companhiaKey ? COMPANIAS_INTERNACIONAL[companhiaKey] : null;

    // ── Foro: domicílio do autor 1 se SP Capital (CDC art. 101, I) ───────────
    const foroAutor =
      getForoByEndereco(autores[0]?.endereco ?? "") ??
      getForoByEndereco(autores[0]?.qualificacao ?? "");

    // ── Detectar se autor é de SP Capital ────────────────────────────────────
    // Verifica CEP na tabela OU "São Paulo" / ", SP" no texto do endereço
    const enderecoAutor1 = (autores[0]?.endereco ?? autores[0]?.qualificacao ?? "");
    const autorEmSP =
      foroAutor !== null ||
      /são paulo/i.test(enderecoAutor1) ||
      /[,\s]sp[,\s.]/i.test(enderecoAutor1);
    const autorForaSP = !autorEmSP;

    // ── Resolve FORO_DESCRICAO e COMARCA ─────────────────────────────────────
    // Prioridade: foro do CEP do autor > foro da empresa
    // IMPORTANTE: se autor é de SP mas CEP não está na tabela, usa comarca SP/SP
    // em vez de cair no foro da empresa (que seria errado).
    const { foro: foroDesc, comarca: comarcaNome } = foroAutor
      ? { foro: foroAutor.foroDescricao, comarca: foroAutor.comarca }
      : autorEmSP
        ? { foro: "a ser distribuído", comarca: "São Paulo/SP" }   // SP sem CEP na tabela
        : parseForo(companhiaInfo?.comarca ?? "");                  // Autor fora de SP → foro da empresa

    // ── Autor 1 (principal para os placeholders do template) ─────────────────
    const autor1 = autores[0] ?? {};
    const qualLimpa1 = (autor1.qualificacao ?? "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const { nome: nome1, restoComVirgula: qual1Resto } = extrairNomeDeQualificacao(qualLimpa1);

    // ── Condicionais para docxtemplater ──────────────────────────────────────
    const algumIdoso = autores.some((a) => a.idoso);
    const temConexao = dados.tipo_rota !== "direto";
    const temCompromisso = dados.perda_compromisso !== "nao";
    // tem_gastos = true SOMENTE se há valores materiais reais (alimentação ou passagem).
    // Ignorar o checkbox — se não há dinheiro, a seção de danos materiais não aparece.
    const temGastos = totalMateriais > 0;
    const semAssistencia = !(dados.recebeu_hospedagem ?? false);

    // ── Placeholders por autor (até 5) ───────────────────────────────────────
    // Nome = texto antes da 1ª vírgula (negrito no template)
    // Qualificação = restante a partir da vírgula (normal no template)
    // REGRA: autores intermediários (não o último) NÃO levam ponto final —
    // o template usa " e " entre eles, então "...São Paulo. e Maria" fica errado.
    const placeholdersAutores: Record<string, string> = {};
    const nomesExtraidos: string[] = [];
    for (let i = 0; i < 5; i++) {
      const n = i + 1;
      const a = autores[i];
      const ql = (a?.qualificacao ?? "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      const { nome: nomeExtraido, restoComVirgula } = extrairNomeDeQualificacao(ql);
      placeholdersAutores[`NOME_AUTOR${n}`] = nomeExtraido;
      // Remove ponto final sempre — o template já tem vírgula/continuação após o placeholder
      placeholdersAutores[`QUALIFICACAO_AUTOR${n}`] = restoComVirgula.replace(/\.\s*$/, "");
      if (i < autores.length) nomesExtraidos.push(nomeExtraido);
    }

    // NOMES_AUTORES combinados: "João e Maria" ou "João, Maria e Pedro"
    const NOMES_AUTORES =
      nomesExtraidos.length === 0 ? "" :
      nomesExtraidos.length === 1 ? nomesExtraidos[0] :
      nomesExtraidos.slice(0, -1).join(", ") + " e " + nomesExtraidos[nomesExtraidos.length - 1];

    const placeholders: Record<string, unknown> = {
      // ── Autores ────────────────────────────────────────────────────────────
      // Nome = antes da 1ª vírgula (bold no template), qualificação = resto
      NOME_AUTOR1: nome1,
      QUALIFICACAO_AUTOR1: qual1Resto,
      // Todos os autores para retrocompatibilidade e templates futuros
      ...placeholdersAutores,
      NOMES_AUTORES,
      NUM_AUTORES: String(numAutores),

      // ── Companhia ──────────────────────────────────────────────────────────
      COMPANHIA_NOME_FANTASIA: companhiaInfo?.nome_fantasia ?? dados.companhia ?? "",
      COMPANHIA_RAZAO_SOCIAL: companhiaInfo?.razao_social ?? dados.companhia ?? "",
      COMPANHIA_CNPJ: companhiaInfo?.cnpj ?? "",
      COMPANHIA_ENDERECO: companhiaInfo?.endereco ?? "",
      COMPANHIA_EMAIL: companhiaInfo?.email ?? "",
      COMPANHIA_TELEFONE: companhiaInfo?.telefone ?? "",
      COMARCA: comarcaNome,
      FORO_DESCRICAO: foroDesc,

      // ── Voo 1 ──────────────────────────────────────────────────────────────
      NUMERO_VOO1: (voo1 as { numero?: string }).numero ?? "",
      ORIGEM_VOO1: (voo1 as { origem_cidade?: string }).origem_cidade ?? "",
      ORIGEM_VOO1_SIGLA: (voo1 as { origem_sigla?: string }).origem_sigla ?? "",
      DESTINO_VOO1: (voo1 as { destino_cidade?: string }).destino_cidade ?? "",
      DESTINO_VOO1_SIGLA: (voo1 as { destino_sigla?: string }).destino_sigla ?? "",
      PARTIDA_VOO1: (voo1 as { partida?: string }).partida ?? "",
      CHEGADA_VOO1: (voo1 as { chegada?: string }).chegada ?? "",
      DATA_VOO1: (voo1 as { data?: string }).data ?? "",
      DATA_VOO_NARRATIVA: (voo1 as { data?: string }).data ?? "",
      DIA_SEMANA_VOO1: (voo1 as { dia_semana?: string }).dia_semana ?? "",

      // ── Voo 2 ──────────────────────────────────────────────────────────────
      NUMERO_VOO2: (voo2 as { numero?: string }).numero ?? "",
      ORIGEM_VOO2: (voo2 as { origem_cidade?: string }).origem_cidade ?? "",
      ORIGEM_VOO2_SIGLA: (voo2 as { origem_sigla?: string }).origem_sigla ?? "",
      DESTINO_VOO2: (voo2 as { destino_cidade?: string }).destino_cidade ?? "",
      DESTINO_VOO2_SIGLA: (voo2 as { destino_sigla?: string }).destino_sigla ?? "",
      PARTIDA_VOO2: (voo2 as { partida?: string }).partida ?? "",
      CHEGADA_VOO2: (voo2 as { chegada?: string }).chegada ?? "",
      DATA_VOO2: (voo2 as { data?: string }).data ?? "",
      DIA_SEMANA_VOO2: (voo2 as { dia_semana?: string }).dia_semana ?? "",

      // ── Voo realocação ─────────────────────────────────────────────────────
      NUMERO_VOO_REALOC: (realoc as { numero?: string }).numero ?? "",
      ORIGEM_VOO_REALOC: (realoc as { origem_cidade?: string }).origem_cidade ?? "",
      DESTINO_VOO_REALOC: (realoc as { destino_cidade?: string }).destino_cidade ?? "",
      DESTINO_VOO_REALOC_SIGLA: "",   // DadosVooRealocacao não tem destino_sigla ainda
      PARTIDA_VOO_REALOC: (realoc as { partida?: string }).partida ?? "",
      CHEGADA_VOO_REALOC: (realoc as { chegada?: string }).chegada ?? "",
      DATA_VOO_REALOC: (realoc as { data?: string }).data ?? "",
      DIA_SEMANA_VOO_REALOC: (realoc as { dia_semana?: string }).dia_semana ?? "",

      // ── Atraso ────────────────────────────────────────────────────────────
      CHEGADA_PREVISTA: dados.chegada_prevista ?? "",
      DATA_CHEGADA_PREVISTA: extrairData(dados.chegada_prevista ?? ""),
      CHEGADA_REAL: dados.chegada_real ?? "",
      TEMPO_ATRASO: atraso.texto,
      TEMPO_ATRASO_SIMPLES: atraso.simples,
      TEMPO_ATRASO_HORAS: (() => {
        const m = atraso.texto?.match(/(\d+)\s*hora/);
        const h = m ? parseInt(m[1]) : 0;
        return h > 0 ? `${h} ${h === 1 ? "hora" : "horas"}` : atraso.simples ?? "";
      })(),

      // ── Cidades ───────────────────────────────────────────────────────────
      CIDADE_ORIGEM: (voo1 as { origem_cidade?: string }).origem_cidade ?? "",
      CIDADE_DESTINO: dados.tipo_rota === "direto"
        ? ((voo1 as { destino_cidade?: string }).destino_cidade ?? "")
        : ((voo2 as { destino_cidade?: string }).destino_cidade ?? ""),
      CIDADE_CONEXAO: temConexao
        ? ((voo1 as { destino_cidade?: string }).destino_cidade ?? "")
        : "",

      // ── Compromisso ───────────────────────────────────────────────────────
      // Template v3.1 usa {~DESC_COMPROMISSO} (raw OOXML) para suportar negrito.
      // A chave "~DESC_COMPROMISSO" é processada por generate-docx.js:
      //   strip do "~" → passa o OOXML cru para docxtemplater sem sanitização.
      // || "" garante que nunca passamos undefined/null para textoParaOOXML.
      "~DESC_COMPROMISSO": textoParaOOXML(descCompromissoReescrito || "", {
        pPrInner: GARAMOND_PPR,
        rPrInner: GARAMOND_RPR,
        rPrBoldExtra: "<w:b/><w:bCs/>",
      }),
      DESC_COMPROMISSO_DETALHE: descDetalheReescrito,
      TIPO_COMPROMISSO: descCompromissoReescrito,

      // ── Relato ────────────────────────────────────────────────────────────
      RELATO: relato,
      PARTICULARIDADE: dados.particularidade ?? "",

      // ── Valores morais ────────────────────────────────────────────────────
      VALOR_MORAIS_POR_AUTOR: valorMoraisPorAutor > 0 ? formatarValor(valorMoraisPorAutor) : "",
      VALOR_MORAIS_POR_AUTOR_EXTENSO: valorMoraisPorAutor > 0 ? valorPorExtenso(valorMoraisPorAutor) : "",
      VALOR_MORAIS_TOTAL: valorMoraisTotal > 0 ? formatarValor(valorMoraisTotal) : "",
      VALOR_MORAIS_TOTAL_EXTENSO: valorMoraisTotal > 0 ? valorPorExtenso(valorMoraisTotal) : "",

      // Aliases retrocompatíveis
      VALOR_MORAIS: valorMoraisPorAutor > 0 ? formatarValor(valorMoraisPorAutor) : "",
      VALOR_MORAIS_EXTENSO: valorMoraisPorAutor > 0 ? valorPorExtenso(valorMoraisPorAutor) : "",

      // ── Valores materiais ─────────────────────────────────────────────────
      VALOR_TOTAL_MATERIAIS: totalMateriais > 0 ? formatarValor(totalMateriais) : "",
      VALOR_TOTAL_MATERIAIS_EXTENSO: totalMateriais > 0 ? valorPorExtenso(totalMateriais) : "",
      VALOR_ALIMENTACAO: valorAlimentacao > 0 ? formatarValor(valorAlimentacao) : "",
      VALOR_PASSAGEM: valorPassagem > 0 ? formatarValor(valorPassagem) : "",
      VALOR_CAUSA_EXTENSO: totalCausa > 0 ? valorPorExtenso(totalCausa) : "",
      VALOR_CAUSA: totalCausa > 0 ? formatarValor(totalCausa) : "",

      // ── Valores em euro (campo livre — preencher futuramente) ─────────────
      VALOR_EURO_ALIMENTACAO: "",
      VALOR_EURO_PASSAGEM: "",
      VALOR_EURO_TOTAL: "",

      // ── Data ──────────────────────────────────────────────────────────────
      DATA_PETICAO: dados.data_peticao || dataAtual(),

      // Parágrafo de competência territorial (domicílio do autor ou sede do réu)
      TEXTO_COMPETENCIA_TERRITORIAL: textoCompetenciaTerritorial(foroAutor),

      // ── Condicionais docxtemplater (booleanos) ────────────────────────────
      idoso: algumIdoso,
      tem_conexao: temConexao,
      tem_compromisso: temCompromisso,
      tem_gastos: temGastos,
      sem_assistencia: semAssistencia,
      // Foro — domicílio do autor (CDC art. 101, I)
      autor_em_sp: autorEmSP,
      autor_fora_sp: autorForaSP,
    };

    const buf = await gerarDocxBuffer(templatePath, placeholders as Record<string, string>);

    const nomesArq = nomesExtraidos.slice(0, 2).join(" e ") || "Autores";
    const nomeArquivo = `Inicial Internacional - ${nomesArq.replace(/[/\\:*?"<>|]/g, "")}.docx`;

    return NextResponse.json({
      docx: Buffer.from(buf).toString("base64"),
      nomeArquivo,
      revisoes: {
        relato_original: dados.relato ?? "",
        relato_reescrito: relato,
        compromisso_original: dados.desc_compromisso ?? "",
        compromisso_reescrito: descCompromissoReescrito,
        detalhe_original: dados.desc_compromisso_detalhe ?? "",
        detalhe_reescrito: descDetalheReescrito,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
