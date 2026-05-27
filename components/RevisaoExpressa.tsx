"use client";

/**
 * RevisaoExpressa — tela de confirmação rápida após extração.
 *
 * Exibe apenas os 8–10 campos mais críticos do caso para que o advogado
 * possa confirmar e gerar sem percorrer o formulário completo de 40+ campos.
 *
 * Campos exibidos:
 *  1. Companhia + tipo de rota
 *  2. Voo 1: número · data · origem → destino
 *  3. Chegada prevista · chegada real · atraso calculado
 *  4. Valor dos danos morais (por autor) + total
 *
 * Badges de confiança da IA: IA ✓ verde / IA ? âmbar / IA ⚠ vermelho
 */

import { useState } from "react";
import { DadosFormulario, ConfiancaExtracao, NivelConfianca } from "@/lib/types";
import { calcularAtraso, calcularAtrasoMinutos, diaDaSemana } from "@/lib/calculos";

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  dados: DadosFormulario;
  onChange: (d: DadosFormulario) => void;
  camposIA: string[];
  confiancas: ConfiancaExtracao;
  onConfirmar: () => void;
  onVerFormulario: () => void;
}

// ── Helpers de badge ───────────────────────────────────────────────────────

function Badge({ campo, camposIA, confiancas }: {
  campo: string;
  camposIA: string[];
  confiancas: ConfiancaExtracao;
}) {
  if (!camposIA.includes(campo)) return null;
  const nivel = (confiancas[campo] as NivelConfianca) ?? "media";
  if (nivel === "alta") return (
    <span title="IA encontrou explicitamente" className="ml-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1 py-0.5 rounded-full">IA ✓</span>
  );
  if (nivel === "baixa") return (
    <span title="IA não encontrou com certeza — confirme" className="ml-1 text-[10px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 px-1 py-0.5 rounded-full">IA ⚠</span>
  );
  return (
    <span title="IA inferiu — verifique" className="ml-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded-full">IA ?</span>
  );
}

function borderColor(campo: string, camposIA: string[], confiancas: ConfiancaExtracao, isEmpty?: boolean): string {
  if (isEmpty) return "border-red-400 dark:border-red-600 ring-1 ring-red-300 bg-red-50/30 dark:bg-red-950/20";
  if (!camposIA.includes(campo)) return "border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800";
  const nivel = (confiancas[campo] as NivelConfianca) ?? "media";
  if (nivel === "alta")  return "border-l-4 border-l-emerald-400 border-emerald-200 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20";
  if (nivel === "baixa") return "border-l-4 border-l-rose-400 border-rose-200 dark:border-rose-700 bg-rose-50/40 dark:bg-rose-950/20";
  return "border-l-4 border-l-amber-400 border-amber-200 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20";
}

// ── Subcomponente de campo ─────────────────────────────────────────────────

function Campo({
  label, campo, value, onChange: onC, placeholder = "", type = "text",
  camposIA, confiancas, obrigatorio = false, validar = false,
}: {
  label: string; campo: string; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string;
  camposIA: string[]; confiancas: ConfiancaExtracao;
  obrigatorio?: boolean; validar?: boolean;
}) {
  const isEmpty = obrigatorio && validar && !value?.trim();
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5 leading-tight">
        {label}
        <Badge campo={campo} camposIA={camposIA} confiancas={confiancas} />
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onC(e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-md px-2.5 py-1.5 text-sm text-gray-900 dark:text-slate-100 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${borderColor(campo, camposIA, confiancas, isEmpty)}`}
      />
      {isEmpty && <p className="text-[10px] text-red-500 mt-0.5">Campo obrigatório</p>}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function RevisaoExpressa({
  dados, onChange, camposIA, confiancas, onConfirmar, onVerFormulario,
}: Props) {
  const [tentouConfirmar, setTentouConfirmar] = useState(false);

  const upd = (patch: Partial<DadosFormulario>) => onChange({ ...dados, ...patch });

  const voo0 = dados.voos?.[0];
  const numAutores = Math.max(1, dados.autores?.length ?? 1);
  const valorPorAutor = parseFloat(dados.valor_morais || "0");
  const totalMorais = valorPorAutor * numAutores;

  const atrasoMin = calcularAtrasoMinutos(
    dados.chegada_prevista ?? "",
    dados.chegada_real ?? ""
  );
  const atrasoTexto = atrasoMin >= 60
    ? calcularAtraso(dados.chegada_prevista ?? "", dados.chegada_real ?? "").texto
    : atrasoMin > 0 ? `${atrasoMin} min`
    : "—";
  const atrasoOk = atrasoMin > 0;

  // Campos obrigatórios nesta tela
  const camposObrigatorios = {
    vooNumero:      !voo0?.numero?.trim(),
    vooData:        !voo0?.data?.trim(),
    chegPrev:       !dados.chegada_prevista?.trim(),
    chegReal:       !dados.chegada_real?.trim(),
    valorMorais:    !dados.valor_morais || parseFloat(dados.valor_morais) <= 0,
  };
  const temErros = Object.values(camposObrigatorios).some(Boolean);

  function handleConfirmar() {
    setTentouConfirmar(true);
    if (temErros) return;
    onConfirmar();
  }

  function atualizarVoo0(campo: string, valor: string) {
    const novosVoos = [...(dados.voos ?? [])];
    const v0 = { ...(novosVoos[0] ?? {}) };
    // @ts-expect-error dynamic key
    v0[campo] = valor;
    if (campo === "data" && valor) v0.dia_semana = diaDaSemana(valor);
    novosVoos[0] = v0;
    upd({ voos: novosVoos });
  }

  // Quantos campos baixa confiança
  const baixaConfiancaCount = camposIA.filter(
    (c) => (confiancas[c] as NivelConfianca) === "baixa"
  ).length;

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-5 py-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs shrink-0">✓</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Extração concluída — Revisão Expressa
            </p>
            <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70">
              Confirme os campos essenciais.
              {baixaConfiancaCount > 0 && (
                <span className="ml-1 text-rose-600 dark:text-rose-400 font-medium">
                  ⚠ {baixaConfiancaCount} campo{baixaConfiancaCount > 1 ? "s" : ""} incerto{baixaConfiancaCount > 1 ? "s" : ""} — atenção especial.
                </span>
              )}
            </p>
          </div>
        </div>
        {/* Legenda compacta */}
        <div className="hidden sm:flex items-center gap-2 text-[10px]">
          <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">IA ✓</span>
          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">IA ?</span>
          <span className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-semibold">IA ⚠</span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* ── SEÇÃO 1: Companhia + Tipo de rota ── */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Voo</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Companhia — read-only se já veio da qualificação */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
                Companhia
                <Badge campo="companhia" camposIA={camposIA} confiancas={confiancas} />
              </label>
              <input
                type="text"
                value={dados.companhia ?? ""}
                onChange={(e) => upd({ companhia: e.target.value })}
                placeholder="Ex: LATAM"
                className={`w-full border rounded-md px-2.5 py-1.5 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${borderColor("companhia", camposIA, confiancas)}`}
              />
            </div>

            {/* Tipo de rota */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Tipo de rota</label>
              <div className="flex gap-4 flex-wrap mt-0.5">
                {(["direto", "conexao", "2conexoes"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      checked={dados.tipo_rota === t}
                      onChange={() => upd({ tipo_rota: t })}
                      className="accent-indigo-600"
                    />
                    {t === "direto" ? "Direto" : t === "conexao" ? "1 conexão" : "2 conexões"}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Voo 1 */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Campo
              label="Nº do voo"
              campo="voos.0.numero"
              value={voo0?.numero ?? ""}
              onChange={(v) => atualizarVoo0("numero", v)}
              placeholder="LA3520"
              obrigatorio validar={tentouConfirmar}
              camposIA={camposIA} confiancas={confiancas}
            />
            <Campo
              label="Data"
              campo="voos.0.data"
              value={voo0?.data ?? ""}
              onChange={(v) => atualizarVoo0("data", v)}
              placeholder="DD/MM/AAAA"
              obrigatorio validar={tentouConfirmar}
              camposIA={camposIA} confiancas={confiancas}
            />
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5 leading-tight">
                Origem
                <Badge campo="voos.0.origem_cidade" camposIA={camposIA} confiancas={confiancas} />
              </label>
              <div className="flex gap-1.5">
                <input
                  value={voo0?.origem_cidade ?? ""}
                  onChange={(e) => atualizarVoo0("origem_cidade", e.target.value)}
                  placeholder="Cidade"
                  className={`flex-1 min-w-0 border rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${borderColor("voos.0.origem_cidade", camposIA, confiancas)}`}
                />
                <input
                  value={voo0?.origem_sigla ?? ""}
                  onChange={(e) => atualizarVoo0("origem_sigla", e.target.value)}
                  placeholder="IATA"
                  className={`w-14 border rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${borderColor("voos.0.origem_sigla", camposIA, confiancas)}`}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5 leading-tight">
                Destino
                <Badge campo="voos.0.destino_cidade" camposIA={camposIA} confiancas={confiancas} />
              </label>
              <div className="flex gap-1.5">
                <input
                  value={voo0?.destino_cidade ?? ""}
                  onChange={(e) => atualizarVoo0("destino_cidade", e.target.value)}
                  placeholder="Cidade"
                  className={`flex-1 min-w-0 border rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${borderColor("voos.0.destino_cidade", camposIA, confiancas)}`}
                />
                <input
                  value={voo0?.destino_sigla ?? ""}
                  onChange={(e) => atualizarVoo0("destino_sigla", e.target.value)}
                  placeholder="IATA"
                  className={`w-14 border rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${borderColor("voos.0.destino_sigla", camposIA, confiancas)}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── SEÇÃO 2: Atraso ── */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Atraso</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Campo
              label="Chegada prevista"
              campo="chegada_prevista"
              value={dados.chegada_prevista ?? ""}
              onChange={(v) => upd({ chegada_prevista: v })}
              placeholder="DD/MM/AAAA HH:MM"
              obrigatorio validar={tentouConfirmar}
              camposIA={camposIA} confiancas={confiancas}
            />
            <Campo
              label="Chegada real"
              campo="chegada_real"
              value={dados.chegada_real ?? ""}
              onChange={(v) => upd({ chegada_real: v })}
              placeholder="DD/MM/AAAA HH:MM"
              obrigatorio validar={tentouConfirmar}
              camposIA={camposIA} confiancas={confiancas}
            />
            {/* Atraso calculado (read-only) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">Atraso calculado</label>
              <div className={`flex items-center gap-2 border rounded-md px-2.5 py-1.5 text-sm font-semibold ${
                atrasoOk
                  ? atrasoMin >= 240
                    ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-400"
              }`}>
                {atrasoOk && <span>{atrasoMin >= 240 ? "⚠" : "✓"}</span>}
                <span>{atrasoOk ? atrasoTexto : "Preencha as datas"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SEÇÃO 3: Danos morais ── */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Valor</p>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[160px] max-w-xs">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
                Danos morais por autor (R$)
                <Badge campo="valor_morais" camposIA={camposIA} confiancas={confiancas} />
              </label>
              <input
                type="number"
                value={dados.valor_morais ?? ""}
                onChange={(e) => upd({ valor_morais: e.target.value })}
                step="500"
                placeholder="8000.00"
                className={`w-full border rounded-md px-2.5 py-1.5 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  borderColor("valor_morais", camposIA, confiancas,
                    tentouConfirmar && camposObrigatorios.valorMorais)
                }`}
              />
              {tentouConfirmar && camposObrigatorios.valorMorais && (
                <p className="text-[10px] text-red-500 mt-0.5">Campo obrigatório</p>
              )}
            </div>
            {numAutores > 0 && valorPorAutor > 0 && (
              <div className="pb-1.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="text-slate-400 dark:text-slate-500">
                  {numAutores} autor{numAutores > 1 ? "es" : ""} ×{" "}
                  R$ {valorPorAutor.toLocaleString("pt-BR")} ={" "}
                </span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  R$ {totalMorais.toLocaleString("pt-BR")} total
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Erros de validação ── */}
        {tentouConfirmar && temErros && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
            Preencha os campos obrigatórios marcados em vermelho antes de confirmar.
          </div>
        )}

        {/* ── Botões ── */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            onClick={handleConfirmar}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            🚀 Confirmar e ir para Revisão
          </button>
          <button
            onClick={onVerFormulario}
            className="sm:w-auto px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
          >
            📋 Ver formulário completo
          </button>
        </div>
      </div>
    </div>
  );
}
