"use client";

import { useState } from "react";
import { DadosFormulario, ConfiancaExtracao, NivelConfianca } from "@/lib/types";
import { calcularAtrasoMinutos, diaDaSemana, dataAtual } from "@/lib/calculos";
import { valorPorExtenso, formatarMoeda } from "@/lib/extenso";

interface Props {
  dados: DadosFormulario;
  onChange: (dados: DadosFormulario) => void;
  camposIA: string[];
  confiancas?: ConfiancaExtracao;
  moraisConfirmado: boolean;
  onMoraisConfirmado: () => void;
  validarCampos?: boolean;
}

// ── Helpers de confiança ──────────────────────────────────────────────────────

const CONFIANCA_BORDER: Record<NivelConfianca, string> = {
  alta:  "border-l-4 border-l-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30",
  media: "border-l-4 border-l-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/40",
  baixa: "border-l-4 border-l-rose-400 border-rose-300 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-950/30",
};

function confiancaBorder(campo: string, camposIA: string[], confiancas: ConfiancaExtracao, erroInline?: boolean): string {
  if (!camposIA.includes(campo)) {
    return erroInline
      ? "border-red-400 dark:border-red-600 ring-1 ring-red-300 dark:ring-red-700 bg-red-50/30 dark:bg-red-950/20"
      : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800";
  }
  const nivel: NivelConfianca = (confiancas[campo] as NivelConfianca) ?? "media";
  return CONFIANCA_BORDER[nivel];
}

// Badge IA colorido por nível de confiança
function IaIcon({ campo, confiancas }: { campo: string; confiancas: ConfiancaExtracao }) {
  const nivel: NivelConfianca = (confiancas[campo] as NivelConfianca) ?? "media";
  if (nivel === "alta") return (
    <span title="IA encontrou este dado explicitamente no documento"
      className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full">
      IA ✓
    </span>
  );
  if (nivel === "baixa") return (
    <span title="IA não encontrou este dado com certeza — confirme obrigatoriamente"
      className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 px-1.5 py-0.5 rounded-full">
      IA ⚠
    </span>
  );
  return (
    <span title="IA inferiu este dado — verifique"
      className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
      IA ?
    </span>
  );
}

export default function AbaFormulario({ dados, onChange, camposIA, confiancas = {}, moraisConfirmado, onMoraisConfirmado, validarCampos }: Props) {
  const upd = (patch: Partial<DadosFormulario>) => onChange({ ...dados, ...patch });
  const [extraindoComprovante, setExtraindoComprovante] = useState<Record<number, boolean>>({});
  const [extraindoCompromisso, setExtraindoCompromisso] = useState(false);
  const [reescrevendoCompromisso, setReescrevendoCompromisso] = useState(false);
  const [contextoCompromisso, setContextoCompromisso] = useState("");
  const [mostrarContextoCompromisso, setMostrarContextoCompromisso] = useState(false);

  function updateVoo(idx: number, field: string, value: string) {
    const voos = [...(dados.voos ?? [{ numero: "", origem_cidade: "", origem_sigla: "", destino_cidade: "", destino_sigla: "", data: "", dia_semana: "", partida: "", chegada: "" }, { numero: "", origem_cidade: "", origem_sigla: "", destino_cidade: "", destino_sigla: "", data: "", dia_semana: "", partida: "", chegada: "" }])];
    voos[idx] = { ...voos[idx], [field]: value };
    if (field === "data" && value) {
      voos[idx].dia_semana = diaDaSemana(value);
    }
    upd({ voos });
  }

  async function extrairCompromissoIA() {
    if (!contextoCompromisso.trim()) return;
    setExtraindoCompromisso(true);
    try {
      const res = await fetch("/api/extrair-compromisso-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: contextoCompromisso }),
      });
      const json = (await res.json()) as { tipo?: string; descricao?: string; detalhe?: string };
      upd({
        perda_compromisso: ((json.tipo === "profissional" ? "profissional" : "pessoal") as DadosFormulario["perda_compromisso"]),
        desc_compromisso: json.descricao || dados.desc_compromisso,
        desc_compromisso_detalhe: json.detalhe || dados.desc_compromisso_detalhe,
      });
      setMostrarContextoCompromisso(false);
      setContextoCompromisso("");
    } catch { /* ignore */ } finally {
      setExtraindoCompromisso(false);
    }
  }

  async function reescreverDescCompromisso() {
    const texto = dados.desc_compromisso ?? "";
    if (!texto.trim()) return;
    setReescrevendoCompromisso(true);
    try {
      const res = await fetch("/api/reescrever-compromisso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) throw new Error("Erro ao reescrever");
      const json = (await res.json()) as { reescrito?: string };
      if (json.reescrito) upd({ desc_compromisso: json.reescrito });
    } catch { /* ignore */ } finally {
      setReescrevendoCompromisso(false);
    }
  }

  async function extrairDeComprovante(idx: number, file: File) {
    setExtraindoComprovante((prev) => ({ ...prev, [idx]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extrair-comprovante", { method: "POST", body: fd });
      const json = await res.json() as { categoria?: string; valor?: string; descricao?: string };
      const novosGastos = [...(dados.gastos ?? [])];
      novosGastos[idx] = {
        ...novosGastos[idx],
        categoria: json.categoria || novosGastos[idx].categoria,
        valor: json.valor || novosGastos[idx].valor,
        descricao: json.descricao || (novosGastos[idx].descricao ?? ""),
      };
      upd({ gastos: novosGastos });
    } catch { /* ignore */ } finally {
      setExtraindoComprovante((prev) => ({ ...prev, [idx]: false }));
    }
  }

  function addGasto() {
    upd({ gastos: [...(dados.gastos ?? []), { categoria: "", descricao: "", valor: "" }] });
  }

  function removeGasto(idx: number) {
    upd({ gastos: (dados.gastos ?? []).filter((_, i) => i !== idx) });
  }

  function updateGasto(idx: number, field: "categoria" | "valor" | "descricao", val: string) {
    const gastos = [...(dados.gastos ?? [])];
    gastos[idx] = { ...gastos[idx], [field]: val };
    upd({ gastos });
  }

  const numAutores = Math.max(1, dados.autores?.length ?? 1);
  const valorMoraisPorAutor = parseFloat(dados.valor_morais || "0");
  const totalMateriais =
    parseFloat(dados.valor_alimentacao || "0") + parseFloat(dados.valor_passagem || "0");
  const totalCausa = valorMoraisPorAutor * numAutores + totalMateriais;

  const inputBase =
    "w-full border rounded-md px-3 py-2 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelBase = "block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1";

  function Field({
    label, campo, value, onChange: onC, type = "text", placeholder = "", textarea = false, erroInline = false,
  }: {
    label: string; campo: string; value: string;
    onChange: (v: string) => void; type?: string; placeholder?: string; textarea?: boolean; erroInline?: boolean;
  }) {
    const ia = camposIA.includes(campo);
    const borderClass = confiancaBorder(campo, camposIA, confiancas, erroInline);
    return (
      <div>
        <label className={labelBase}>
          {label}
          {ia && <IaIcon campo={campo} confiancas={confiancas} />}
        </label>
        {textarea ? (
          <textarea
            value={value}
            onChange={(e) => onC(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className={`${inputBase} ${borderClass}`}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onC(e.target.value)}
            placeholder={placeholder}
            className={`${inputBase} ${borderClass}`}
          />
        )}
      </div>
    );
  }

  // Contagem de campos por nível de confiança
  const camposIACount = camposIA.length;
  const baixaConfianca = camposIA.filter((c) => (confiancas[c] as NivelConfianca) === "baixa");
  const mediaConfianca = camposIA.filter((c) => (confiancas[c] as NivelConfianca | undefined) === "media" || !confiancas[c]);
  const altaConfianca  = camposIA.filter((c) => (confiancas[c] as NivelConfianca) === "alta");

  return (
    <div className="space-y-8">

      {/* ── Legenda de confiança (só aparece quando há campos IA) ── */}
      {camposIACount > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-3">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            🤖 {camposIACount} campo{camposIACount !== 1 ? "s" : ""} preenchido{camposIACount !== 1 ? "s" : ""} pela IA
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            {altaConfianca.length > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <strong>{altaConfianca.length}</strong> extraído com clareza
                <span className="font-mono bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded">IA ✓</span>
              </span>
            )}
            {mediaConfianca.length > 0 && (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                <strong>{mediaConfianca.length}</strong> inferido — verifique
                <span className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">IA ?</span>
              </span>
            )}
            {baixaConfianca.length > 0 && (
              <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
                <strong>{baixaConfianca.length}</strong> incerto — confirme antes de gerar
                <span className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">IA ⚠</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* TEMPLATE */}
      <section>
        <h3 className="font-semibold text-gray-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2 mb-4">Template</h3>
        <div>
          <label className={labelBase}>Modelo de petição</label>
          <select
            value={dados.template}
            onChange={(e) => upd({ template: e.target.value })}
            disabled={dados.template.startsWith("voo-internacional")}
            className={`${inputBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 ${
              dados.template.startsWith("voo-internacional")
                ? "opacity-70 cursor-not-allowed"
                : ""
            }`}
          >
            <option value="voo-nacional-1-autor">Voo Nacional — 1 Autor</option>
            <option value="voo-nacional-multiplos-autores" disabled>
              Voo Nacional — Múltiplos Autores (em breve)
            </option>
            <option value="voo-internacional-multi-autor">Voo Internacional — Múltiplos Autores</option>
          </select>
        </div>
      </section>

      {/* VOO */}
      <section>
        <h3 className="font-semibold text-gray-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2 mb-4">Informações do Voo</h3>

        <div className="mb-4">
          <label className={labelBase}>Tipo de rota</label>
          <div className="flex gap-4 flex-wrap">
            {(["direto", "conexao", "2conexoes"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={dados.tipo_rota === t}
                  onChange={() => upd({ tipo_rota: t })}
                  className="accent-blue-700"
                />
                <span className="text-sm">
                  {t === "direto" ? "Direto" : t === "conexao" ? "Com 1 conexão" : "Com 2 conexões"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Voos contratados</h4>
        {[0, ...(dados.tipo_rota !== "direto" ? [1] : []), ...(dados.tipo_rota === "2conexoes" ? [2] : [])].map((idx) => {
          const voo = dados.voos?.[idx] ?? {};
          const pref = `voos.${idx}`;
          return (
            <div key={idx} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 mb-4 bg-gray-50 dark:bg-slate-800/50">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-3">
                {idx === 0 ? "Voo 1 (trecho de ida)" : idx === 1 ? "Voo 2 (conexão)" : "Voo 3 (2ª conexão)"}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field
                  label="Nº do voo"
                  campo={`${pref}.numero`}
                  value={(voo as { numero?: string }).numero ?? ""}
                  onChange={(v) => updateVoo(idx, "numero", v)}
                  placeholder="G3 1234"
                  erroInline={validarCampos && idx === 0 && !dados.voos?.[0]?.numero?.trim()}
                />
                <Field
                  label="Data"
                  campo={`${pref}.data`}
                  value={(voo as { data?: string }).data ?? ""}
                  onChange={(v) => updateVoo(idx, "data", v)}
                  placeholder="DD/MM/AAAA"
                  erroInline={validarCampos && idx === 0 && !dados.voos?.[0]?.data?.trim()}
                />
                <Field
                  label="Dia da semana"
                  campo={`${pref}.dia_semana`}
                  value={(voo as { dia_semana?: string }).dia_semana ?? ""}
                  onChange={(v) => updateVoo(idx, "dia_semana", v)}
                  placeholder="segunda-feira"
                />
                <div></div>
                <Field
                  label="Cidade origem"
                  campo={`${pref}.origem_cidade`}
                  value={(voo as { origem_cidade?: string }).origem_cidade ?? ""}
                  onChange={(v) => updateVoo(idx, "origem_cidade", v)}
                  placeholder="Fortaleza"
                />
                <Field
                  label="Sigla origem"
                  campo={`${pref}.origem_sigla`}
                  value={(voo as { origem_sigla?: string }).origem_sigla ?? ""}
                  onChange={(v) => updateVoo(idx, "origem_sigla", v)}
                  placeholder="FOR"
                />
                <Field
                  label="Cidade destino"
                  campo={`${pref}.destino_cidade`}
                  value={(voo as { destino_cidade?: string }).destino_cidade ?? ""}
                  onChange={(v) => updateVoo(idx, "destino_cidade", v)}
                  placeholder="São Paulo"
                />
                <Field
                  label="Sigla destino"
                  campo={`${pref}.destino_sigla`}
                  value={(voo as { destino_sigla?: string }).destino_sigla ?? ""}
                  onChange={(v) => updateVoo(idx, "destino_sigla", v)}
                  placeholder="GRU"
                />
                <Field
                  label="Horário partida"
                  campo={`${pref}.partida`}
                  value={(voo as { partida?: string }).partida ?? ""}
                  onChange={(v) => updateVoo(idx, "partida", v)}
                  placeholder="06:00"
                />
                <Field
                  label="Horário chegada"
                  campo={`${pref}.chegada`}
                  value={(voo as { chegada?: string }).chegada ?? ""}
                  onChange={(v) => updateVoo(idx, "chegada", v)}
                  placeholder="09:00"
                />
              </div>
            </div>
          );
        })}

        <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 mt-4">Voo de realocação</h4>
        <div className="border border-orange-200 dark:border-amber-800 rounded-lg p-4 bg-orange-50 dark:bg-amber-950/30 grid grid-cols-2 md:grid-cols-3 gap-3">
          {(
            [
              ["Nº do voo", "numero", "voo_realocacao.numero", "G3 9999"],
              ["Cidade origem", "origem_cidade", "voo_realocacao.origem_cidade", "São Paulo"],
              ["Cidade destino", "destino_cidade", "voo_realocacao.destino_cidade", "Rio de Janeiro"],
              ["Data", "data", "voo_realocacao.data", "DD/MM/AAAA"],
              ["Horário partida", "partida", "voo_realocacao.partida", "21:00"],
              ["Horário chegada", "chegada", "voo_realocacao.chegada", "22:00"],
            ] as [string, string, string, string][]
          ).map(([label, field, campo, placeholder]) => (
            <Field
              key={field}
              label={label}
              campo={campo}
              value={((dados.voo_realocacao as unknown) as Record<string, string>)?.[field] ?? ""}
              onChange={(v) => {
                const r = { ...(dados.voo_realocacao as unknown as Record<string, string>), [field]: v } as unknown as DadosFormulario["voo_realocacao"];
                upd({ voo_realocacao: r });
              }}
              placeholder={placeholder}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Field
            label="Chegada prevista no destino"
            campo="chegada_prevista"
            value={dados.chegada_prevista ?? ""}
            onChange={(v) => upd({ chegada_prevista: v })}
            placeholder="DD/MM/AAAA HH:MM"
            erroInline={validarCampos && !dados.chegada_prevista?.trim()}
          />
          <Field
            label="Chegada real no destino"
            campo="chegada_real"
            value={dados.chegada_real ?? ""}
            onChange={(v) => upd({ chegada_real: v })}
            placeholder="DD/MM/AAAA HH:MM"
            erroInline={validarCampos && !dados.chegada_real?.trim()}
          />
          <div>
            <label className={labelBase}>Tempo de atraso</label>
            <input
              type="text"
              value={dados.tempo_atraso ?? ""}
              onChange={(e) => upd({ tempo_atraso: e.target.value })}
              placeholder="Calculado automaticamente"
              className={`${inputBase} border-gray-300 dark:border-slate-600`}
            />
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Calculado automaticamente. Edite se necessário.
            </p>
          </div>
        </div>
      </section>

      {/* ASSISTÊNCIA */}
      <section>
        <h3 className="font-semibold text-gray-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2 mb-4">
          Assistência e Danos
        </h3>

        <div className="mb-4">
          <label className={labelBase}>Perda de compromisso</label>
          <div className="flex gap-4 flex-wrap">
            {(
              [
                ["profissional", "Profissional"],
                ["pessoal", "Pessoal"],
                ["nao", "Não houve"],
              ] as [string, string][]
            ).map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={dados.perda_compromisso === val}
                  onChange={() => upd({ perda_compromisso: val as DadosFormulario["perda_compromisso"] })}
                  className="accent-blue-700"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Painel IA — descrever motivo para auto-preencher */}
        <div className="mb-3">
          {!mostrarContextoCompromisso ? (
            <button
              type="button"
              onClick={() => setMostrarContextoCompromisso(true)}
              className="inline-flex items-center gap-1.5 text-xs bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-3 py-1.5 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/50 transition"
            >
              <span className="font-bold">IA</span>
              <span>Preencher motivo da perda automaticamente</span>
            </button>
          ) : (
            <div className="border border-amber-300 dark:border-amber-700 rounded-lg p-3 bg-amber-50/60 dark:bg-amber-950/30">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-2">
                Descreva o motivo da viagem e a IA preencherá o tipo e a descrição do compromisso:
              </p>
              <textarea
                value={contextoCompromisso}
                onChange={(e) => setContextoCompromisso(e.target.value)}
                placeholder="ex: compramos a passagem para chegar antes da Páscoa e poder descansar do fuso horário, o que não foi possível devido ao atraso..."
                rows={3}
                className="w-full border border-amber-200 dark:border-amber-700 rounded-md px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2 resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={extrairCompromissoIA}
                  disabled={extraindoCompromisso || !contextoCompromisso.trim()}
                  className="text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md font-semibold transition"
                >
                  {extraindoCompromisso ? "Processando..." : "✦ Extrair com IA"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMostrarContextoCompromisso(false); setContextoCompromisso(""); }}
                  className="text-xs text-gray-500 dark:text-slate-400 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {dados.perda_compromisso !== "nao" && dados.perda_compromisso && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Descrição do compromisso com botão de reescrita IA */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelBase}>
                  Descrição do compromisso
                  {camposIA.includes("desc_compromisso") && <IaIcon campo="desc_compromisso" confiancas={confiancas} />}
                </label>
                <button
                  type="button"
                  title="Reescrever com IA em linguagem jurídica"
                  onClick={reescreverDescCompromisso}
                  disabled={reescrevendoCompromisso || !(dados.desc_compromisso ?? "").trim()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {reescrevendoCompromisso ? (
                    <>
                      <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Reescrevendo…
                    </>
                  ) : (
                    <>✨ Reescrever com IA</>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={dados.desc_compromisso ?? ""}
                onChange={(e) => upd({ desc_compromisso: e.target.value })}
                placeholder="ex: reunião de negócios"
                className={`${inputBase} ${confiancaBorder("desc_compromisso", camposIA, confiancas)}`}
              />
              <p className="mt-0.5 text-[10px] text-gray-400 dark:text-slate-500">
                Digite o compromisso e clique ✨ para reescrever em linguagem jurídica.
              </p>
            </div>
            <Field
              label="Detalhe (horário, data)"
              campo="desc_compromisso_detalhe"
              value={dados.desc_compromisso_detalhe ?? ""}
              onChange={(v) => upd({ desc_compromisso_detalhe: v })}
              placeholder="ex: às 14h do dia 15/06/2025"
            />
          </div>
        )}

        {/* Vulnerabilidade — acréscimo de R$1.000 */}
        <div className="mt-2">
          <label className={labelBase}>
            Situação de vulnerabilidade
            <span className="ml-2 text-gray-400 dark:text-slate-500 font-normal">(acréscimo de R$ 1.000)</span>
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
            {/* Idoso */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dados.autores?.[0]?.idoso ?? false}
                onChange={(e) => {
                  const autores = [...(dados.autores ?? [{}])];
                  autores[0] = { ...autores[0], idoso: e.target.checked };
                  upd({ autores });
                }}
                className="accent-blue-700 w-4 h-4"
              />
              <span className="text-sm">Idoso (≥ 60 anos)</span>
            </label>
            {/* Condição especial */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dados.condicao_especial ?? false}
                onChange={(e) => upd({ condicao_especial: e.target.checked })}
                className="accent-blue-700 w-4 h-4"
              />
              <span className="text-sm">Condição especial (autismo, deficiência, doença...)</span>
            </label>
            {/* Gestante */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dados.gestante_bebe === "gestante"}
                onChange={(e) => upd({ gestante_bebe: e.target.checked ? "gestante" : "nao" })}
                className="accent-pink-500 w-4 h-4"
              />
              <span className="text-sm">Gestante</span>
            </label>
            {/* Bebê de colo */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dados.gestante_bebe === "bebe"}
                onChange={(e) => upd({ gestante_bebe: e.target.checked ? "bebe" : "nao" })}
                className="accent-pink-500 w-4 h-4"
              />
              <span className="text-sm">Com bebê de colo</span>
            </label>
          </div>
        </div>

        {/* Hospedagem — redução de R$1.000 */}
        <div className="mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dados.recebeu_hospedagem ?? false}
              onChange={(e) => upd({ recebeu_hospedagem: e.target.checked })}
              className="accent-red-500 w-4 h-4"
            />
            <span className="text-sm">
              Recebeu auxílio hospedagem da companhia
              <span className="ml-2 text-gray-400 dark:text-slate-500 font-normal text-xs">(redução de R$ 1.000)</span>
            </span>
          </label>
        </div>

      </section>

      {/* GASTOS */}
      <section>
        <h3 className="font-semibold text-gray-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2 mb-4">Gastos e Valores</h3>

        <div className="mb-4">
          <label className={labelBase}>Houve gastos extras comprovados?</label>
          <div className="flex gap-4">
            {(
              [
                [true, "Sim"],
                [false, "Não"],
              ] as [boolean, string][]
            ).map(([val, label]) => (
              <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={dados.tem_gastos === val}
                  onChange={() => upd({ tem_gastos: val })}
                  className="accent-blue-700"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {dados.tem_gastos && (
          <div className="mb-4">
            <div className="space-y-3 mb-2">
              {(dados.gastos ?? []).map((g, idx) => (
                <div key={idx} className="border border-gray-200 dark:border-slate-600 rounded-lg p-3 bg-gray-50 dark:bg-slate-800/50 space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={g.categoria}
                      onChange={(e) => updateGasto(idx, "categoria", e.target.value)}
                      placeholder="Categoria (ex: alimentação, passagem)"
                      className={`${inputBase} border-gray-300 dark:border-slate-600 flex-1`}
                    />
                    <input
                      type="number"
                      value={g.valor}
                      onChange={(e) => updateGasto(idx, "valor", e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      className={`${inputBase} border-gray-300 dark:border-slate-600 w-32`}
                    />
                    <button
                      type="button"
                      onClick={() => removeGasto(idx)}
                      className="text-red-500 hover:text-red-700 text-lg font-bold px-1 shrink-0"
                    >
                      ×
                    </button>
                    <button
                      type="button"
                      title="Extrair categoria e valor de uma foto do comprovante"
                      disabled={extraindoComprovante[idx]}
                      onClick={() => {
                        const inp = document.createElement("input");
                        inp.type = "file";
                        inp.accept = "image/*";
                        inp.onchange = (e) => {
                          const f = (e.target as HTMLInputElement).files?.[0];
                          if (f) extrairDeComprovante(idx, f);
                        };
                        inp.click();
                      }}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 text-base px-1 shrink-0 disabled:opacity-40"
                    >
                      {extraindoComprovante[idx] ? "⏳" : "📷"}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={g.descricao ?? ""}
                    onChange={(e) => updateGasto(idx, "descricao", e.target.value)}
                    placeholder="Descrição (opcional — ex: lanche no aeroporto GRU)"
                    className={`${inputBase} border-gray-300 dark:border-slate-600`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-1">
              <button type="button" onClick={addGasto} className="text-blue-700 dark:text-blue-400 text-sm hover:underline">
                + Adicionar manualmente
              </button>
              <button
                type="button"
                onClick={() => {
                  const inp = document.createElement("input");
                  inp.type = "file";
                  inp.accept = "image/*";
                  inp.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (!f) return;
                    const novoIdx = (dados.gastos ?? []).length;
                    const novosGastos = [...(dados.gastos ?? []), { categoria: "", descricao: "", valor: "" }];
                    upd({ gastos: novosGastos });
                    setTimeout(() => extrairDeComprovante(novoIdx, f), 0);
                  };
                  inp.click();
                }}
                className="text-indigo-700 dark:text-indigo-400 text-sm hover:underline flex items-center gap-1"
              >
                📷 Adicionar por foto
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            {/* Layout lado a lado: campo + tabela */}
            <div className="flex flex-col md:flex-row gap-4">

              {/* Coluna esquerda: campo + botão */}
              <div className="flex-1 min-w-0">
                <label className={labelBase}>
                  Valor dos danos morais POR AUTOR (R$)
                  {camposIA.includes("valor_morais") && <IaIcon campo="valor_morais" confiancas={confiancas} />}
                </label>
                <input
                  type="number"
                  value={dados.valor_morais ?? ""}
                  onChange={(e) => upd({ valor_morais: e.target.value })}
                  step="0.01"
                  placeholder="8000.00"
                  className={`${inputBase} ${confiancaBorder("valor_morais", camposIA, confiancas)}${validarCampos && (!dados.valor_morais || parseFloat(dados.valor_morais || "0") <= 0) ? " border-red-400 dark:border-red-600 ring-1 ring-red-300" : ""}`}
                />

                {/* Fundamentação da sugestão automática */}
                {(() => {
                  const atrasoMin = calcularAtrasoMinutos(
                    dados.chegada_prevista ?? "",
                    dados.chegada_real ?? ""
                  );
                  if (atrasoMin < 240) return null;
                  const FAIXAS = [
                    { label: "4 – 6 horas",   min: 240,  max: 360,      base: 6500 },
                    { label: "6 – 8 horas",   min: 360,  max: 480,      base: 7000 },
                    { label: "8 – 12 horas",  min: 480,  max: 720,      base: 7500 },
                    { label: "12 – 16 horas", min: 720,  max: 960,      base: 8500 },
                    { label: "16 – 24 horas", min: 960,  max: 1440,     base: 12000 },
                    { label: "> 24 horas",    min: 1440, max: 2880,     base: 15000 },
                    { label: "> 48 horas",    min: 2880, max: Infinity, base: 20000 },
                  ];
                  const faixa = FAIXAS.find(f => atrasoMin >= f.min && atrasoMin < f.max);
                  if (!faixa) return null;

                  const perdaComp  = dados.perda_compromisso !== "nao" ? dados.perda_compromisso : "nao";
                  const idoso      = dados.autores?.[0]?.idoso ?? false;
                  const vulneravel = idoso || dados.gestante_bebe !== "nao" || (dados.condicao_especial ?? false);
                  const hospedagem = dados.recebeu_hospedagem ?? false;

                  type Linha = { texto: string; valor: number; tipo: "base" | "mais" | "menos" };
                  const linhas: Linha[] = [];
                  linhas.push({ texto: faixa.label, valor: faixa.base, tipo: "base" });
                  if (perdaComp !== "nao") linhas.push({ texto: "perda de compromisso", valor: 1000, tipo: "mais" });
                  if (vulneravel)         linhas.push({ texto: "situação de vulnerabilidade", valor: 1000, tipo: "mais" });
                  if (hospedagem)         linhas.push({ texto: "auxílio hospedagem recebido", valor: 1000, tipo: "menos" });

                  const total = faixa.base
                    + (perdaComp !== "nao" ? 1000 : 0)
                    + (vulneravel ? 1000 : 0)
                    - (hospedagem ? 1000 : 0);

                  const corLinha = (tipo: Linha["tipo"]) =>
                    tipo === "base"  ? "text-gray-600 dark:text-slate-400" :
                    tipo === "mais"  ? "text-emerald-600 dark:text-emerald-400" :
                                      "text-red-500 dark:text-red-400";

                  return (
                    <div className="mt-2 mb-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-3 py-2 text-xs space-y-0.5">
                      {linhas.map((l, i) => (
                        <div key={i} className={`flex justify-between gap-2 ${corLinha(l.tipo)}`}>
                          <span>
                            {l.tipo === "base" ? l.texto : l.tipo === "mais" ? `+ ${l.texto}` : `− ${l.texto}`}
                          </span>
                          <span className="font-mono font-semibold shrink-0">
                            {l.tipo === "base"  ? formatarMoeda(l.valor) :
                             l.tipo === "mais"  ? `+R$ ${l.valor.toLocaleString("pt-BR")}` :
                                                  `−R$ ${l.valor.toLocaleString("pt-BR")}`}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between gap-2 pt-1 border-t border-indigo-200 dark:border-indigo-700 font-semibold text-indigo-700 dark:text-indigo-300">
                        <span>Total sugerido</span>
                        <span className="font-mono">{formatarMoeda(total)}</span>
                      </div>
                    </div>
                  );
                })()}

                {!moraisConfirmado ? (
                  <button
                    type="button"
                    onClick={onMoraisConfirmado}
                    disabled={!dados.valor_morais || parseFloat(dados.valor_morais || "0") <= 0}
                    className="mt-2 w-full py-3 text-sm font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:animate-none bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-md ring-2 ring-red-400 ring-offset-1 animate-pulse hover:animate-none"
                  >
                    ⚠ CONFIRMAR ASSISTÊNCIAS, VULNERABILIDADES E DANOS MORAIS — clique para avançar
                  </button>
                ) : (
                  <div className="mt-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <span className="w-4 h-4 bg-emerald-500 rounded-full text-white flex items-center justify-center text-[9px] font-bold shrink-0">✓</span>
                    Valor confirmado — {formatarMoeda(parseFloat(dados.valor_morais || "0"))}
                  </div>
                )}
              </div>

              {/* Coluna direita: tabela de referência */}
              {(() => {
                const atrasoMin = calcularAtrasoMinutos(
                  dados.chegada_prevista ?? "",
                  dados.chegada_real ?? ""
                );
                const faixas = [
                  { label: "4 – 6 horas",   min: 240,  max: 360,      base: 6500 },
                  { label: "6 – 8 horas",   min: 360,  max: 480,      base: 7000 },
                  { label: "8 – 12 horas",  min: 480,  max: 720,      base: 7500 },
                  { label: "12 – 16 horas", min: 720,  max: 960,      base: 8500 },
                  { label: "16 – 24 horas", min: 960,  max: 1440,     base: 12000 },
                  { label: "> 24 horas",    min: 1440, max: 2880,     base: 15000 },
                  { label: "> 48 horas",    min: 2880, max: Infinity, base: 20000 },
                ];
                return (
                  <div className="md:w-64 shrink-0 rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden text-xs self-start">
                    <div className="bg-gray-100 dark:bg-slate-700 px-2.5 py-1.5 text-gray-500 dark:text-slate-300 font-semibold text-[10px] uppercase tracking-wide">
                      Tabela de referência — Dano Moral
                    </div>
                    <div className="overflow-y-auto max-h-44">
                    <table className="w-full">
                      <tbody>
                        {faixas.map((f) => {
                          const ativo = atrasoMin > 0 && atrasoMin >= f.min && atrasoMin < f.max;
                          return (
                            <tr
                              key={f.label}
                              className={ativo
                                ? "bg-indigo-50 dark:bg-indigo-900/50"
                                : "odd:bg-white dark:odd:bg-slate-800/30 even:bg-gray-50 dark:even:bg-slate-800/60"}
                            >
                              <td className={`px-2.5 py-1.5 border-t border-gray-100 dark:border-slate-700 ${
                                ativo ? "text-indigo-700 dark:text-indigo-300 font-bold" : "text-gray-600 dark:text-slate-400"
                              }`}>
                                {ativo && <span className="mr-1">▶</span>}{f.label}
                              </td>
                              <td className={`px-2.5 py-1.5 border-t border-gray-100 dark:border-slate-700 text-right font-mono font-semibold ${
                                ativo ? "text-indigo-700 dark:text-indigo-300" : "text-gray-500 dark:text-slate-400"
                              }`}>
                                R$ {f.base.toLocaleString("pt-BR")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-700/50 px-2.5 py-1.5 border-t border-gray-200 dark:border-slate-600 text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed">
                      <span className="font-semibold text-gray-500 dark:text-slate-400">Acréscimos / Reduções:</span>
                      <span className="block">+R$ 1.000 perda de compromisso comprovada</span>
                      <span className="block">+R$ 1.000 idoso · gestante · bebê · condição especial</span>
                      <span className="block text-red-400 dark:text-red-400">−R$ 1.000 recebeu auxílio hospedagem</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <div>
            <label className={labelBase}>Por extenso</label>
            <input
              type="text"
              value={dados.valor_morais_extenso ?? ""}
              onChange={(e) => upd({ valor_morais_extenso: e.target.value })}
              placeholder="Preenchido automaticamente"
              className={`${inputBase} border-gray-300 dark:border-slate-600`}
            />
          </div>
          <div>
            <label className={labelBase}>Valor de alimentação (R$)</label>
            <input
              type="number"
              value={dados.valor_alimentacao ?? ""}
              onChange={(e) => upd({ valor_alimentacao: e.target.value })}
              step="0.01"
              placeholder="0.00"
              className={`${inputBase} border-gray-300 dark:border-slate-600`}
            />
          </div>
          <div>
            <label className={labelBase}>Total materiais</label>
            <input
              readOnly
              value={totalMateriais > 0 ? formatarMoeda(totalMateriais) : "—"}
              className={`${inputBase} bg-gray-100 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 cursor-not-allowed`}
            />
          </div>
          <div>
            <label className={labelBase}>Valor total da causa</label>
            <input
              readOnly
              value={totalCausa > 0 ? `${formatarMoeda(totalCausa)} (${valorPorExtenso(totalCausa)})` : "—"}
              className={`${inputBase} bg-gray-100 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 cursor-not-allowed`}
            />
          </div>
        </div>
      </section>

      {/* PROCESSUAL */}
      <section>
        <h3 className="font-semibold text-gray-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2 mb-4">Dados Processuais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="max-w-xs">
            <Field
              label="Data da petição"
              campo="data_peticao"
              value={dados.data_peticao ?? dataAtual()}
              onChange={(v) => upd({ data_peticao: v })}
              placeholder="DD/MM/AAAA"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
