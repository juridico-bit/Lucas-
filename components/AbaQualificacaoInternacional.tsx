"use client";

import { useEffect, useRef, useState } from "react";
import { parse, isValid, differenceInYears } from "date-fns";
import { COMPANIAS_INTERNACIONAL, CompanhiaInternacionalKey } from "@/lib/companias";
import { DadosFormulario } from "@/lib/types";
import { getForoByEndereco } from "@/lib/foros-sp";

const AUTOR_VAZIO = {
  nome: "",
  qualificacao: "",
  cpf: "",
  rg: "",
  email: "",
  endereco: "",
  data_nascimento: "",
  idoso: false,
};

const MAX_AUTORES = 5;

// ─── Utilitários de gênero ────────────────────────────────────────────────────

/** Pares [masculino, feminino] para substituição automática */
const PARES_GENERO: Array<[string, string]> = [
  ["homem",       "mulher"],
  ["brasileiro",  "brasileira"],
  ["estrangeiro", "estrangeira"],
  ["americano",   "americana"],
  ["italiano",    "italiana"],
  ["argentino",   "argentina"],
  ["português",   "portuguesa"],
  ["casado",      "casada"],
  ["solteiro",    "solteira"],
  ["divorciado",  "divorciada"],
  ["separado",    "separada"],
  ["nascido",     "nascida"],
  ["domiciliado", "domiciliada"],
  ["inscrito",    "inscrita"],
  ["portador",    "portadora"],
];

/** Detecta gênero a partir das palavras presentes no texto de qualificação */
function detectarGeneroDoTexto(texto: string): "M" | "F" | null {
  for (const [masc, fem] of PARES_GENERO) {
    if (new RegExp(`\\b${fem}\\b`, "i").test(texto)) return "F";
    if (new RegExp(`\\b${masc}\\b`, "i").test(texto)) return "M";
  }
  return null;
}

function detectarGeneroPeloNome(nomeCompleto: string): "M" | "F" {
  const primeiro = (nomeCompleto.trim().split(/\s+/)[0] ?? "").toLowerCase();
  if (!primeiro) return "M";
  const excecoesMasc = ["luca", "icaro", "ícaro", "nikita", "elijah", "josua", "yura"];
  if (excecoesMasc.includes(primeiro)) return "M";
  if (primeiro.endsWith("a")) return "F";
  return "M";
}

function corrigirGeneroQualificacao(texto: string, genero: "M" | "F"): string {
  if (!texto.trim()) return texto;
  let r = texto;

  // Substitui pares de palavras gendrificadas
  for (const [masc, fem] of PARES_GENERO) {
    const [from, to] = genero === "M" ? [fem, masc] : [masc, fem];
    r = r.replace(
      new RegExp(`\\b${from}\\b`, "gi"),
      (match) =>
        match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()
          ? to.charAt(0).toUpperCase() + to.slice(1)
          : to
    );
  }

  if (genero === "M") {
    r = r.replace(/o\s*\(a\)/gi, "o");
    r = r.replace(/\s*\(a\)/g, "");
  } else {
    r = r.replace(/o\s*\(a\)/gi, "a");
    r = r.replace(/\s*\(a\)/g, "a");
  }

  const partes = r.split(",");
  if (partes.length >= 3) {
    partes[2] = partes[2].replace(
      /^(\s*)([A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ])/,
      (_, sp, lt) => sp + lt.toLowerCase()
    );
  }
  return partes.join(",");
}

const OPCOES_COMPANHIA_INTERNACIONAL = [
  { value: "",          label: "Selecione..." },
  { value: "LATAM",     label: "Latam Airlines" },
  { value: "GOL",       label: "GOL Linhas Aéreas" },
  { value: "AZUL",      label: "Azul Linhas Aéreas" },
  { value: "AIR_FRANCE",label: "Air France" },
  { value: "KLM",       label: "KLM Royal Dutch Airlines" },
  { value: "TAP",       label: "TAP Air Portugal" },
  { value: "AMERICAN",  label: "American Airlines" },
  { value: "UNITED",    label: "United Airlines" },
  { value: "EMIRATES",  label: "Emirates" },
  { value: "IBERIA",    label: "Iberia" },
  { value: "ITA",       label: "ITA Airways" },
];

function SelectCompanhiaInternacional({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label =
    OPCOES_COMPANHIA_INTERNACIONAL.find((o) => o.value === value)?.label ?? "Selecione...";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800"
      >
        <span className={value === "" ? "text-gray-400 dark:text-slate-500" : ""}>{label}</span>
        <span className="ml-2 text-gray-400 dark:text-slate-400 text-xs">▼</span>
      </button>

      {aberto && (
        <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md shadow-lg overflow-hidden">
          {OPCOES_COMPANHIA_INTERNACIONAL.map((op) => (
            <li
              key={op.value}
              onClick={() => { onChange(op.value); setAberto(false); }}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                op.value === value
                  ? "bg-indigo-600 text-white"
                  : "text-gray-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-slate-700"
              }`}
            >
              {op.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  dados: DadosFormulario;
  onChange: (dados: DadosFormulario) => void;
  camposIA: string[];
  validarCampos?: boolean;
  maxAutores?: number;
}

// ─── Card de um autor ─────────────────────────────────────────────────────────
interface AutorCardProps {
  index: number;
  autor: DadosFormulario["autores"][0];
  total: number;
  onUpdate: (patch: Partial<DadosFormulario["autores"][0]>) => void;
  onRemove: () => void;
  validarCampos?: boolean;
}

function AutorCard({ index, autor, total, onUpdate, onRemove, validarCampos }: AutorCardProps) {
  const inputBase =
    "w-full border rounded-md px-3 py-2 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelBase = "block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1";

  const inputImagemRef = useRef<HTMLInputElement>(null);
  const [extraindoNasc, setExtraindoNasc] = useState(false);
  const [erroNasc, setErroNasc] = useState("");
  const [flashGenero, setFlashGenero] = useState<"M" | "F" | null>(null);

  const generoDetectado = autor.nome ? detectarGeneroPeloNome(autor.nome) : null;

  function aplicarCorrecaoGenero(genero: "M" | "F") {
    const corrigido = corrigirGeneroQualificacao(autor.qualificacao ?? "", genero);
    onUpdate({ qualificacao: corrigido });
    setFlashGenero(genero);
    setTimeout(() => setFlashGenero(null), 2000);
  }

  function aplicarCorrecaoAutoBlur() {
    const qual = autor.qualificacao ?? "";
    if (!qual.trim()) return;
    const genero = detectarGeneroDoTexto(qual) ?? (autor.nome ? detectarGeneroPeloNome(autor.nome) : null);
    if (!genero) return;
    const corrigido = corrigirGeneroQualificacao(qual, genero);
    if (corrigido === qual) return;
    onUpdate({ qualificacao: corrigido });
    setFlashGenero(genero);
    setTimeout(() => setFlashGenero(null), 2000);
  }

  async function handleImagemNascimento(file: File) {
    setExtraindoNasc(true);
    setErroNasc("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extrair-nascimento", { method: "POST", body: fd });
      const json = (await res.json()) as { data?: string; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Erro ao extrair data");
      const val = json.data!;
      let idoso = false;
      try {
        const nasc = parse(val, "dd/MM/yyyy", new Date());
        if (isValid(nasc)) idoso = differenceInYears(new Date(), nasc) >= 60;
      } catch { /* ignore */ }
      onUpdate({ data_nascimento: val, idoso });
    } catch (e) {
      setErroNasc(e instanceof Error ? e.message : "Erro ao extrair data");
    } finally {
      setExtraindoNasc(false);
    }
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
      {/* Cabeçalho do card */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
          Autor {index + 1}
        </span>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            ✕ Remover
          </button>
        )}
      </div>

      {/* Qualificação civil */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-600 dark:text-slate-300">
            Qualificação civil completa
            <span className="ml-2 text-gray-400 dark:text-slate-500 font-normal">(cole da procuração)</span>
            <span className="ml-2 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded font-normal">Obrigatório</span>
          </label>
          <div className="flex items-center gap-1.5">
            {flashGenero && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">✓ Corrigido</span>
            )}
            {generoDetectado && !flashGenero && (
              <span className="text-[10px] text-gray-400 dark:text-slate-500">
                detectado: {generoDetectado === "M" ? "masc." : "fem."}
              </span>
            )}
            <button
              type="button"
              onClick={() => aplicarCorrecaoGenero("M")}
              className={`px-2 py-0.5 text-xs rounded border font-medium transition-colors ${
                generoDetectado === "M"
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              ♂ Masc.
            </button>
            <button
              type="button"
              onClick={() => aplicarCorrecaoGenero("F")}
              className={`px-2 py-0.5 text-xs rounded border font-medium transition-colors ${
                generoDetectado === "F"
                  ? "bg-pink-500 text-white border-pink-500 hover:bg-pink-600"
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-pink-400 hover:text-pink-600"
              }`}
            >
              ♀ Fem.
            </button>
          </div>
        </div>
        <textarea
          value={autor.qualificacao ?? ""}
          onChange={(e) => onUpdate({ qualificacao: e.target.value })}
          onBlur={aplicarCorrecaoAutoBlur}
          rows={3}
          className={`${inputBase} border-gray-300 dark:border-slate-600${validarCampos && !autor.qualificacao?.trim() ? " border-red-400 dark:border-red-600 ring-1 ring-red-300" : ""}`}
          placeholder="Nome completo, nacionalidade, profissão, estado civil, inscrito no CPF sob o nº, portador do RG sob o nº, endereço completo..."
        />
      </div>

      {/* Data de nascimento */}
      <div>
        <label className={labelBase}>Data de nascimento</label>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            value={autor.data_nascimento ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              let idoso = autor.idoso ?? false;
              if (val.length === 10) {
                try {
                  const nasc = parse(val, "dd/MM/yyyy", new Date());
                  if (isValid(nasc)) idoso = differenceInYears(new Date(), nasc) >= 60;
                } catch { /* ignore */ }
              }
              onUpdate({ data_nascimento: val, idoso });
            }}
            placeholder="DD/MM/AAAA"
            maxLength={10}
            className={`${inputBase} border-gray-300 dark:border-slate-600 w-44`}
          />

          <button
            type="button"
            title="Enviar foto do RG ou CNH para extrair a data automaticamente"
            onClick={() => inputImagemRef.current?.click()}
            disabled={extraindoNasc}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {extraindoNasc ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span>Extraindo...</span>
              </>
            ) : (
              <><span>📷</span><span>Foto do doc.</span></>
            )}
          </button>

          <input
            ref={inputImagemRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImagemNascimento(file);
              e.target.value = "";
            }}
          />

          {(() => {
            const dn = autor.data_nascimento ?? "";
            if (dn.length < 10) return null;
            try {
              const nasc = parse(dn, "dd/MM/yyyy", new Date());
              if (!isValid(nasc)) return <span className="text-xs text-red-500">Data inválida</span>;
              const idade = differenceInYears(new Date(), nasc);
              return (
                <span className={`text-sm font-medium ${idade >= 60 ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-slate-400"}`}>
                  {idade} anos{idade >= 60 ? " — idoso ✓" : ""}
                </span>
              );
            } catch { return null; }
          })()}
        </div>
        {erroNasc && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">⚠ {erroNasc}</p>
        )}
        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500 leading-snug">
          ℹ️ Preencha somente se o sistema da Resolvvi avisar que o autor é idoso (≥ 60 anos).
        </p>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AbaQualificacaoInternacional({ dados, onChange, validarCampos, maxAutores }: Props) {
  const upd = (patch: Partial<DadosFormulario>) => onChange({ ...dados, ...patch });
  const autores = dados.autores ?? [{ ...AUTOR_VAZIO }];
  const limiteAutores = maxAutores ?? MAX_AUTORES;

  function updateAutor(idx: number, patch: Partial<DadosFormulario["autores"][0]>) {
    const novo = [...autores];
    novo[idx] = { ...novo[idx], ...patch };
    upd({ autores: novo, num_autores: novo.length });
  }

  function addAutor() {
    if (autores.length >= limiteAutores) return;
    const novo = [...autores, { ...AUTOR_VAZIO }];
    upd({ autores: novo, num_autores: novo.length });
  }

  function removeAutor(idx: number) {
    if (autores.length <= 1) return;
    const novo = autores.filter((_, i) => i !== idx);
    upd({ autores: novo, num_autores: novo.length });
  }

  const companhia = dados.companhia
    ? COMPANIAS_INTERNACIONAL[dados.companhia as CompanhiaInternacionalKey] ?? null
    : null;

  // Detecta foro do domicílio do autor 1 em tempo real (busca CEP na qualificação)
  const foroAutor = getForoByEndereco(dados.autores?.[0]?.qualificacao ?? "");

  const labelBase = "block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1";
  const inputBase =
    "w-full border rounded-md px-3 py-2 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="space-y-8">

      {/* ── AUTORES ── */}
      <section>
        <div className="flex items-center justify-between border-b dark:border-slate-700 pb-2 mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">
            Autores
            <span className="ml-2 text-xs font-normal text-slate-400">
              {autores.length} de {limiteAutores} máx.
            </span>
          </h3>
          <button
            type="button"
            onClick={addAutor}
            disabled={autores.length >= limiteAutores}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
          >
            + Adicionar autor
          </button>
        </div>

        <div className="space-y-4">
          {autores.map((autor, idx) => (
            <AutorCard
              key={idx}
              index={idx}
              autor={autor}
              total={autores.length}
              onUpdate={(patch) => updateAutor(idx, patch)}
              onRemove={() => removeAutor(idx)}
              validarCampos={validarCampos}
            />
          ))}
        </div>
      </section>

      {/* ── COMPANHIA ── */}
      <section>
        <h3 className="font-semibold text-gray-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2 mb-4">
          Companhia aérea (Ré)
          <span className="ml-2 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded font-normal align-middle">Obrigatório</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelBase}>Companhia aérea</label>
            <SelectCompanhiaInternacional
              value={dados.companhia ?? ""}
              onChange={(v) => upd({ companhia: v })}
            />
          </div>

          {companhia && (
            <>
              <div>
                <label className={labelBase}>Razão social</label>
                <input
                  readOnly
                  value={companhia.razao_social}
                  className={`${inputBase} bg-gray-100 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 cursor-not-allowed`}
                />
              </div>
              <div>
                <label className={labelBase}>CNPJ</label>
                <input
                  readOnly
                  value={companhia.cnpj}
                  className={`${inputBase} bg-gray-100 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 cursor-not-allowed`}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelBase}>Endereço</label>
                <input
                  readOnly
                  value={companhia.endereco}
                  className={`${inputBase} bg-gray-100 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 cursor-not-allowed`}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelBase}>Competência territorial</label>
                {foroAutor ? (
                  <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700">
                    <span className="text-base mt-0.5">🏛️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-0.5">
                        Domicílio do autor · SP Capital
                        <span className="ml-2 text-[10px] font-normal text-blue-500 dark:text-blue-400">CDC art. 101, I</span>
                      </p>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {foroAutor.foroDescricao}
                      </p>
                      <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-0.5">
                        Comarca de {foroAutor.comarca}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-base mt-0.5">🏢</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                        Sede do réu
                      </p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {companhia.comarca || "—"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label className={labelBase}>Data da petição</label>
            <input
              type="text"
              value={dados.data_peticao ?? ""}
              onChange={(e) => upd({ data_peticao: e.target.value })}
              className={`${inputBase} border-gray-300 dark:border-slate-600`}
              placeholder="DD/MM/AAAA"
            />
          </div>
        </div>
      </section>

    </div>
  );
}
