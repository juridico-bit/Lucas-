export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PizZip = require("pizzip") as typeof import("pizzip");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Docxtemplater = require("docxtemplater") as typeof import("docxtemplater");
import JSZip from "jszip";
import { COMPANIAS, CompanhiaKey } from "@/lib/companias";
import { valorPorExtenso, formatarValor } from "@/lib/extenso";
import { calcularAtraso, dataAtual } from "@/lib/calculos";
import { DadosFormulario } from "@/lib/types";
import { reescreverTerceiraPessoa } from "@/lib/reescrever";

async function gerarDocx(dados: DadosFormulario): Promise<Buffer> {
  const templatePath = join(process.cwd(), "templates", "voo-nacional-1-autor.docx");
  const content = readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  const [relatoReescrito, descCompromissoReescrito, descDetalheReescrito] =
    await Promise.all([
      reescreverTerceiraPessoa(dados.relato ?? ""),
      reescreverTerceiraPessoa(dados.desc_compromisso ?? ""),
      reescreverTerceiraPessoa(dados.desc_compromisso_detalhe ?? ""),
    ]);

  const companhia = COMPANIAS[dados.companhia as CompanhiaKey];
  const autor = dados.autores[0];
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

  const placeholders: Record<string, string> = {
    NOME_AUTOR: autor?.nome ?? "",
    QUALIFICACAO_CIVIL: autor?.qualificacao ?? "",
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
    CIDADE_ORIGEM: (voo1 as { origem_cidade?: string }).origem_cidade ?? "",
    CIDADE_DESTINO: dados.tipo_rota === "direto"
      ? ((voo1 as { destino_cidade?: string }).destino_cidade ?? "")
      : ((voo2 as { destino_cidade?: string }).destino_cidade ?? ""),
    CIDADE_CONEXAO: dados.tipo_rota === "conexao"
      ? ((voo1 as { destino_cidade?: string }).destino_cidade ?? "")
      : "",
    DATA_VOO_NARRATIVA: (voo1 as { data?: string }).data ?? "",
    DESC_COMPROMISSO: descCompromissoReescrito,
    DESC_COMPROMISSO_DETALHE: descDetalheReescrito,

    RELATO: relatoReescrito,
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
  };

  doc.render(placeholders);
  return Buffer.from(doc.getZip().generate({ type: "arraybuffer" }) as ArrayBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { lote: DadosFormulario[] };
    const { lote } = body;

    if (!lote || lote.length === 0) {
      return NextResponse.json({ error: "Lote vazio" }, { status: 400 });
    }

    const zipFinal = new JSZip();

    for (const dados of lote) {
      const docxBuf = await gerarDocx(dados);
      const autor = dados.autores[0];
      const nomeArquivo = `Inicial - ${(autor?.nome ?? "Autor").replace(/[/\\:*?"<>|]/g, "")}.docx`;
      zipFinal.file(nomeArquivo, docxBuf);
    }

    const zipBuffer = await zipFinal.generateAsync({ type: "arraybuffer" });

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Lote_Peticoes_${dataAtual().replace(/\//g, "-")}.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
