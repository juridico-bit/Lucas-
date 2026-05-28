export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { join } from "node:path";
import { COMPANIAS, CompanhiaKey } from "@/lib/companias";
import { getForoByEndereco, textoCompetenciaTerritorial } from "@/lib/foros-sp";

function parseForo(comarcaStr: string): { foro: string; comarca: string } {
  const sep = / da Comarca de /i;
  const idx = comarcaStr.search(sep);
  if (idx !== -1) {
    return {
      foro: comarcaStr.slice(0, idx).trim(),
      comarca: comarcaStr.slice(idx).replace(sep, "").trim(),
    };
  }
  return { foro: "", comarca: comarcaStr.replace(/^Comarca de /i, "").trim() };
}
import { valorPorExtenso, formatarValor } from "@/lib/extenso";
import { calcularAtraso, dataAtual } from "@/lib/calculos";
import { DadosFormulario } from "@/lib/types";
import { gerarDocxBuffer } from "@/lib/generate";
import { reescreverTerceiraPessoa } from "@/lib/reescrever";
import { gerarDescCompromisso } from "@/lib/compromisso";
import { enqueueAI } from "@/lib/ai-queue";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { dados: DadosFormulario };
    const { dados } = body;

    // RELATO: usa o texto original do cliente sem reescrita por IA
    const relato = dados.relato ?? "";

    // Texto do compromisso: pode vir do campo de texto ou de arquivo extraído
    const textoCompromisso = (dados.desc_compromisso ?? "").trim();

    const [descCompromissoGerado, descDetalheReescrito] =
      await Promise.all([
        enqueueAI(() => gerarDescCompromisso(textoCompromisso), "gerar-desc-compromisso"),
        enqueueAI(() => reescreverTerceiraPessoa(dados.desc_compromisso_detalhe ?? ""), "reescrever-detalhe"),
      ]);

    const companhia = COMPANIAS[dados.companhia as CompanhiaKey];
    const autor = dados.autores[0];

    // ── Foro: domicílio do autor se SP Capital (CDC art. 101, I) ────────────
    // Procura CEP no endereço ou qualificação; se SP Capital, usa foro regional
    const foroAutor =
      getForoByEndereco(autor?.endereco ?? "") ??
      getForoByEndereco(autor?.qualificacao ?? "");

    // Detecta SP mesmo quando CEP não está na tabela (ex.: bairros sem cobertura)
    const enderecoAutorNac = (autor?.endereco ?? autor?.qualificacao ?? "");
    const autorNacEmSP =
      foroAutor !== null ||
      /são paulo/i.test(enderecoAutorNac) ||
      /[,\s]sp[,\s.]/i.test(enderecoAutorNac);

    // Prioridade: foro do CEP > SP sem cobertura > foro da empresa (autor fora de SP)
    const { foro: foroDesc, comarca: comarcaNome } = foroAutor
      ? { foro: foroAutor.foroDescricao, comarca: foroAutor.comarca }
      : autorNacEmSP
        ? { foro: "a ser distribuído", comarca: "São Paulo/SP" }
        : parseForo(companhia?.comarca ?? "");
    const voo1 = dados.voos[0] ?? {};
    const voo2 = dados.voos[1] ?? {};

    const valorMorais = parseFloat(dados.valor_morais || "0");
    const valorAlimentacao = parseFloat(dados.valor_alimentacao || "0");
    const valorPassagem = parseFloat(dados.valor_passagem || "0");
    const totalMateriais = valorAlimentacao + valorPassagem;
    const totalCausa = valorMorais + totalMateriais;

    // Remove "e 0 minutos" de valores cached anteriores ao fix
    const tempoTexto = (dados.tempo_atraso ?? "").replace(/\s+e\s+0\s+minutos?/i, "").trim();
    const atraso = tempoTexto
      ? { texto: tempoTexto, simples: dados.tempo_atraso_simples }
      : calcularAtraso(dados.chegada_prevista, dados.chegada_real);

    // Normaliza qualificação: remove quebras de linha e espaços duplicados
    const qualificacaoLimpa = (autor?.qualificacao ?? "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Extrai nome (antes da 1ª vírgula) — negrito no template
    const primeiraVirgula = qualificacaoLimpa.indexOf(",");
    const nomeAutor = primeiraVirgula === -1 ? qualificacaoLimpa : qualificacaoLimpa.slice(0, primeiraVirgula).trim();
    // Remove ponto final — o template já tem vírgula/continuação após o placeholder
    const qualificacaoSemNome = (primeiraVirgula === -1 ? "" : qualificacaoLimpa.slice(primeiraVirgula)).replace(/\.\s*$/, "");

    const placeholders: Record<string, string> = {
      NOME_AUTOR: nomeAutor,
      QUALIFICACAO_CIVIL: qualificacaoSemNome,
      CPF_AUTOR: autor?.cpf ?? "",
      RG_AUTOR: autor?.rg ?? "",
      EMAIL_AUTOR: autor?.email ?? "",
      ENDERECO_AUTOR: autor?.endereco ?? "",

      COMPANHIA_NOME_FANTASIA: companhia?.nome_fantasia ?? dados.companhia,
      COMPANHIA_RAZAO_SOCIAL: companhia?.razao_social ?? "",
      COMPANHIA_CNPJ: companhia?.cnpj ?? "",
      COMPANHIA_ENDERECO: companhia?.endereco ?? "",
      COMPANHIA_EMAIL: companhia?.email ?? "",
      COMPANHIA_TELEFONE: companhia?.telefone ?? "",
      COMARCA: comarcaNome,
      FORO_DESCRICAO: foroDesc,

      NUMERO_VOO1: (voo1 as { numero?: string }).numero ?? "",
      ORIGEM_VOO1: (voo1 as { origem_cidade?: string; origem_sigla?: string }).origem_cidade
        ? `${(voo1 as { origem_cidade: string }).origem_cidade}/${(voo1 as { origem_sigla: string }).origem_sigla}`
        : "",
      DESTINO_VOO1_SIGLA: (voo1 as { destino_sigla?: string }).destino_sigla ?? "",
      PARTIDA_VOO1: (voo1 as { partida?: string }).partida ?? "",
      CHEGADA_VOO1: (voo1 as { chegada?: string }).chegada ?? "",
      DATA_VOO1: (voo1 as { data?: string }).data ?? "",
      DIA_SEMANA_VOO1: (voo1 as { dia_semana?: string }).dia_semana ?? "",

      NUMERO_VOO2: (voo2 as { numero?: string }).numero ?? "",
      ORIGEM_VOO2: (voo2 as { origem_cidade?: string; origem_sigla?: string }).origem_cidade
        ? `${(voo2 as { origem_cidade: string }).origem_cidade}/${(voo2 as { origem_sigla: string }).origem_sigla}`
        : "",
      DESTINO_VOO2_CIDADE: (voo2 as { destino_cidade?: string }).destino_cidade ?? "",
      DESTINO_VOO2_SIGLA: (voo2 as { destino_sigla?: string }).destino_sigla ?? "",
      PARTIDA_VOO2: (voo2 as { partida?: string }).partida ?? "",
      CHEGADA_VOO2: (voo2 as { chegada?: string }).chegada ?? "",
      DATA_VOO2: (voo2 as { data?: string }).data ?? "",
      DIA_SEMANA_VOO2: (voo2 as { dia_semana?: string }).dia_semana ?? "",

      NUMERO_VOO_REALOC: dados.voo_realocacao?.numero ?? "",
      PARTIDA_VOO_REALOC: dados.voo_realocacao?.partida ?? "",
      CHEGADA_VOO_REALOC: dados.voo_realocacao?.chegada ?? "",

      CHEGADA_PREVISTA: dados.chegada_prevista ?? "",
      CHEGADA_REAL: dados.chegada_real ?? "",
      TEMPO_ATRASO: atraso.texto,
      TEMPO_ATRASO_SIMPLES: atraso.simples,
      TEMPO_ATRASO_HORAS: (() => {
        const min = atraso.texto ? (() => {
          const m = atraso.texto.match(/(\d+)\s*hora/); return m ? parseInt(m[1]) : 0;
        })() : 0;
        return min > 0 ? `${min} ${min === 1 ? "hora" : "horas"}` : atraso.simples ?? "";
      })(),

      CIDADE_ORIGEM: (voo1 as { origem_cidade?: string }).origem_cidade ?? "",
      CIDADE_DESTINO: dados.tipo_rota === "direto"
        ? ((voo1 as { destino_cidade?: string }).destino_cidade ?? "")
        : ((voo2 as { destino_cidade?: string }).destino_cidade ?? ""),
      CIDADE_CONEXAO: dados.tipo_rota === "conexao"
        ? ((voo1 as { destino_cidade?: string }).destino_cidade ?? "")
        : "",
      DATA_VOO_NARRATIVA: (voo1 as { data?: string }).data ?? "",

      // || "" garante string vazia em vez de undefined/null
      // A verificação extra remove o literal "undefined" que pode vir do localStorage
      DESC_COMPROMISSO: (descCompromissoGerado === "undefined" ? "" : descCompromissoGerado) || "",
      DESC_COMPROMISSO_DETALHE: descDetalheReescrito,

      RELATO: relato,
      PARTICULARIDADE: dados.particularidade ?? "",

      VALOR_MORAIS: valorMorais > 0 ? formatarValor(valorMorais) : "",
      VALOR_MORAIS_EXTENSO: valorMorais > 0 ? valorPorExtenso(valorMorais) : "",
      VALOR_TOTAL_MATERIAIS: totalMateriais > 0 ? formatarValor(totalMateriais) : "",
      VALOR_TOTAL_MATERIAIS_EXTENSO: totalMateriais > 0 ? valorPorExtenso(totalMateriais) : "",
      VALOR_CAUSA: totalCausa > 0 ? formatarValor(totalCausa) : "",
      VALOR_CAUSA_EXTENSO: totalCausa > 0 ? valorPorExtenso(totalCausa) : "",
      VALOR_ALIMENTACAO: valorAlimentacao > 0 ? formatarValor(valorAlimentacao) : "",
      VALOR_PASSAGEM: valorPassagem > 0 ? formatarValor(valorPassagem) : "",

      DATA_PETICAO: dados.data_peticao || dataAtual(),

      // Parágrafo de competência territorial (domicílio do autor ou sede do réu)
      TEXTO_COMPETENCIA_TERRITORIAL: textoCompetenciaTerritorial(foroAutor),
    };

    const templatePath = join(process.cwd(), "templates", "voo-nacional-1-autor.docx");
    const buf = await gerarDocxBuffer(templatePath, placeholders);

    const nomeArquivo = `Inicial - ${nomeAutor.replace(/[/\\:*?"<>|]/g, "") || "Autor"}.docx`;

    return NextResponse.json({
      docx: Buffer.from(buf).toString("base64"),
      nomeArquivo,
      revisoes: {
        relato_original: dados.relato ?? "",
        relato_reescrito: relato,
        compromisso_original: dados.desc_compromisso ?? "",
        compromisso_reescrito: descCompromissoGerado || "",
        detalhe_original: dados.desc_compromisso_detalhe ?? "",
        detalhe_reescrito: descDetalheReescrito,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
