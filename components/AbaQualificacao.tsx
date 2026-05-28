"use client";

import { useEffect, useRef, useState } from "react";
import { parse, isValid, differenceInYears } from "date-fns";
import { COMPANIAS, CompanhiaKey } from "@/lib/companias";
import { DadosFormulario } from "@/lib/types";
import { getForoByEndereco } from "@/lib/foros-sp";

function formatarCPF(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ─── Utilitários de gênero ────────────────────────────────────────────────────

/** Pares [masculino, feminino] para substituição automática */
const PARES_GENERO: Array<[string, string]> = [
  // Nacionalidade / origem
  ["homem",           "mulher"],
  ["brasileiro",      "brasileira"],
  ["estrangeiro",     "estrangeira"],
  ["americano",       "americana"],
  ["italiano",        "italiana"],
  ["argentino",       "argentina"],
  ["português",       "portuguesa"],
  ["espanhol",        "espanhola"],
  ["francês",         "francesa"],
  ["alemão",          "alemã"],
  // Estado civil
  ["casado",          "casada"],
  ["solteiro",        "solteira"],
  ["divorciado",      "divorciada"],
  ["separado",        "separada"],
  ["viúvo",           "viúva"],
  ["companheiro",     "companheira"],
  // Profissões
  ["engenheiro",      "engenheira"],
  ["advogado",        "advogada"],
  ["médico",          "médica"],
  ["professor",       "professora"],
  ["empresário",      "empresária"],
  ["aposentado",      "aposentada"],
  ["servidor",        "servidora"],
  ["funcionário",     "funcionária"],
  ["técnico",         "técnica"],
  ["contador",        "contadora"],
  ["arquiteto",       "arquiteta"],
  ["psicólogo",       "psicóloga"],
  ["enfermeiro",      "enfermeira"],
  ["administrador",   "administradora"],
  ["programador",     "programadora"],
  ["autônomo",        "autônoma"],
  // Outros
  ["nascido",         "nascida"],
  ["domiciliado",     "domiciliada"],
  ["inscrito",        "inscrita"],
  ["portador",        "portadora"],
  ["residente",       "residente"],
];

/** Detecta gênero a partir das palavras presentes no texto de qualificação */
function detectarGeneroDoTexto(texto: string): "M" | "F" | null {
  for (const [masc, fem] of PARES_GENERO) {
    if (new RegExp(`\\b${fem}\\b`, "i").test(texto)) return "F";
    if (new RegExp(`\\b${masc}\\b`, "i").test(texto)) return "M";
  }
  return null;
}

/** Heurística para detectar gênero pelo primeiro nome brasileiro */
function detectarGeneroPeloNome(nomeCompleto: string): "M" | "F" {
  const primeiro = (nomeCompleto.trim().split(/\s+/)[0] ?? "").toLowerCase();
  if (!primeiro) return "M";
  // Exceções masculinas que terminam em 'a'
  const excecoesMasc = ["luca", "icaro", "ícaro", "nikita", "elijah", "josua", "yura"];
  if (excecoesMasc.includes(primeiro)) return "M";
  if (primeiro.endsWith("a")) return "F";
  return "M";
}

/** Corrige a qualificação para o gênero informado.
 *  - Substitui pares de palavras gendrificadas (brasileiro↔brasileira, casado↔casada, etc.)
 *  - Remove/substitui padrões "(a)"
 *  - Coloca nacionalidade em minúsculo
 *  - Coloca primeira letra da profissão em minúsculo
 */
function corrigirGeneroQualificacao(texto: string, genero: "M" | "F"): string {
  if (!texto.trim()) return texto;
  let r = texto;

  // 1. PRIMEIRO: resolver padrões "(a)" antes das substituições de pares.
  // Motivo: "Brasileiro(a)" → par substitui "Brasileiro" → "Brasileira(a)" →
  // depois (a) vira "a" → "Brasileiraa". A ordem correta evita esse duplo "a".
  if (genero === "M") {
    // o(a) → o  |  (a) → remove
    r = r.replace(/o\s*\(a\)/gi, "o");
    r = r.replace(/\s*\(a\)/g, "");
  } else {
    // "brasileira(a)" → "brasileira"  (já feminino — só remove o marcador)
    r = r.replace(/a\s*\(a\)/gi, "a");
    // "brasileiro(a)" → "brasileira"  (masculino → feminino)
    r = r.replace(/o\s*\(a\)/gi, "a");
    // demais "(a)" após consoante, ex: "engenheir(a)" → "engenheira"
    r = r.replace(/\s*\(a\)/g, "a");
  }

  // 2. DEPOIS: substituir pares de palavras gendrificadas
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

  // 3. Proteção final: elimina vogal duplicada ao fim de palavra ("casadaa" → "casada")
  r = r.replace(/([aeiou])\1\b/gi, "$1");

  // 4. Lowercase primeira letra da profissão (3.ª segmento separado por vírgula)
  const partes = r.split(",");
  if (partes.length >= 3) {
    partes[2] = partes[2].replace(
      /^(\s*)([A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ])/,
      (_, sp, lt) => sp + lt.toLowerCase()
    );
  }

  return partes.join(",");
}

interface Props {
  dados: DadosFormulario;
  onChange: (dados: DadosFormulario) => void;
  camposIA: string[];
  validarCampos?: boolean;
}

const OPCOES_COMPANHIA = [
  { value: "", label: "Selecione..." },
  { value: "LATAM", label: "Latam Airlines" },
  { value: "GOL", label: "GOL Linhas Aéreas" },
  { value: "AZUL", label: "Azul Linhas Aéreas" },
];

function SelectCompanhia({ value, onChange, ia }: { value: string; onChange: (v: string) => void; ia: boolean }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = OPCOES_COMPANHIA.find((o) => o.value === value)?.label ?? "Selecione...";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className={`w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
          ia
            ? "border-l-4 border-l-amber-400 border-gray-200 bg-amber-50/40"
            : "border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800"
        }`}
      >
        <span className={value === "" ? "text-gray-400 dark:text-slate-500" : ""}>{label}</span>
        <span className="ml-2 text-gray-400 dark:text-slate-400 text-xs">▼</span>
      </button>

      {aberto && (
        <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md shadow-lg overflow-hidden">
          {OPCOES_COMPANHIA.map((op) => (
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

function IaIcon() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
      IA
    </span>
  );
}

export default function AbaQualificacao({ dados, onChange, camposIA, validarCampos }: Props) {
  const upd = (patch: Partial<DadosFormulario>) => onChange({ ...dados, ...patch });
  const autor = dados.autores?.[0] ?? {};
  const companhia = dados.companhia ? COMPANIAS[dados.companhia as CompanhiaKey] : null;

  // Detecta foro do domicílio do autor em tempo real (busca CEP na qualificação)
  const foroAutor = getForoByEndereco(autor?.qualificacao ?? "");
  const [flashGenero, setFlashGenero] = useState<"M" | "F" | null>(null);

  // ── Upload de imagem para extração de data de nascimento ──────────────────
  const inputImagemRef = useRef<HTMLInputElement>(null);
  const [extraindoNasc, setExtraindoNasc] = useState(false);
  const [erroNasc, setErroNasc] = useState("");

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
      const autores = [...(dados.autores ?? [{}])];
      let idoso = false;
      try {
        const nasc = parse(val, "dd/MM/yyyy", new Date());
        if (isValid(nasc)) idoso = differenceInYears(new Date(), nasc) >= 60;
      } catch { /* ignore */ }
      autores[0] = { ...autores[0], data_nascimento: val, idoso };
      upd({ autores });
    } catch (e) {
      setErroNasc(e instanceof Error ? e.message : "Erro ao extrair data");
    } finally {
      setExtraindoNasc(false);
    }
  }

  const inputBase =
    "w-full border rounded-md px-3 py-2 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-800 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelBase = "block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1";

  function aplicarCorrecaoGenero(genero: "M" | "F") {
    const qual = autor.qualificacao ?? "";
    const corrigido = corrigirGeneroQualificacao(qual, genero);
    const autores = [...(dados.autores ?? [{}])];
    autores[0] = { ...autores[0], qualificacao: corrigido };
    upd({ autores });
    setFlashGenero(genero);
    setTimeout(() => setFlashGenero(null), 2000);
  }

  return (
    <div className="space-y-8">

      {/* AUTOR */}
      <section>
        <h3 className="font-semibold text-gray-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2 mb-4">
          Autor
        </h3>
        <div className="space-y-4">
          {/* Qualificação civil completa */}
          <div>
            {/* Label + botões de gênero */}
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600 dark:text-slate-300">
                Qualificação civil completa
                <span className="ml-2 text-gray-400 dark:text-slate-500 font-normal">(cole da procuração)</span>
                <span className="ml-2 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded font-normal">Obrigatório</span>
              </label>
              <div className="flex items-center gap-1.5">
                {flashGenero && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">
                    ✓ Corrigido
                  </span>
                )}
                <button
                  type="button"
                  title="Aplicar forma masculina"
                  onClick={() => aplicarCorrecaoGenero("M")}
                  className="px-2 py-0.5 text-xs rounded border font-medium transition-colors bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:text-blue-600"
                >
                  ♂ Masc.
                </button>
                <button
                  type="button"
                  title="Aplicar forma feminina"
                  onClick={() => aplicarCorrecaoGenero("F")}
                  className="px-2 py-0.5 text-xs rounded border font-medium transition-colors bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-pink-400 hover:text-pink-600"
                >
                  ♀ Fem.
                </button>
              </div>
            </div>
            <textarea
              value={autor.qualificacao ?? ""}
              onChange={(e) => {
                const autores = [...(dados.autores ?? [{}])];
                autores[0] = { ...autores[0], qualificacao: e.target.value };
                upd({ autores });
              }}
              rows={4}
              className={`${inputBase} border-gray-300${validarCampos && !autor.qualificacao?.trim() ? " border-red-400 dark:border-red-600 ring-1 ring-red-300" : ""}`}
              placeholder="Nome completo, nacionalidade, profissão, estado civil, inscrito no CPF sob o nº, portador do RG sob o nº, endereço completo..."
            />
            <p className="mt-0.5 text-[10px] text-gray-400 dark:text-slate-500">
              Cole a qualificação exatamente como está na procuração. Use os botões ♂/♀ para corrigir o gênero se necessário.
            </p>
          </div>

          {/* Data de nascimento + detecção automática de idoso */}
          <div>
            <label className={labelBase}>Data de nascimento</label>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="text"
                value={autor.data_nascimento ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const autores = [...(dados.autores ?? [{}])];
                  let idoso = autores[0]?.idoso ?? false;
                  if (val.length === 10) {
                    try {
                      const nascimento = parse(val, "dd/MM/yyyy", new Date());
                      if (isValid(nascimento)) {
                        idoso = differenceInYears(new Date(), nascimento) >= 60;
                      }
                    } catch { /* ignore */ }
                  }
                  autores[0] = { ...autores[0], data_nascimento: val, idoso };
                  upd({ autores });
                }}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className={`${inputBase} border-gray-300 dark:border-slate-600 w-44`}
              />

              {/* Botão para upload de imagem/print do documento */}
              <button
                type="button"
                title="Enviar foto do RG, CNH ou outro documento para extrair a data automaticamente"
                onClick={() => inputImagemRef.current?.click()}
                disabled={extraindoNasc}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <>
                    <span>📷</span>
                    <span>Foto do doc.</span>
                  </>
                )}
              </button>

              {/* Input file oculto */}
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

              {/* Indicador de idade */}
              {(() => {
                const dn = autor.data_nascimento ?? "";
                if (dn.length < 10) return null;
                try {
                  const nasc = parse(dn, "dd/MM/yyyy", new Date());
                  if (!isValid(nasc)) return (
                    <span className="text-xs text-red-500">Data inválida</span>
                  );
                  const idade = differenceInYears(new Date(), nasc);
                  return (
                    <span className={`text-sm font-medium ${
                      idade >= 60
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-500 dark:text-slate-400"
                    }`}>
                      {idade} anos{idade >= 60 ? " — idoso ✓" : ""}
                    </span>
                  );
                } catch { return null; }
              })()}
            </div>

            {/* Erro na extração de imagem */}
            {erroNasc && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <span>⚠</span> {erroNasc}
              </p>
            )}
            <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-500">
              Digite manualmente ou envie uma foto do RG, CNH ou outro documento para extração automática.
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-snug">
              ℹ️ Preencha somente se o sistema da Resolvvi avisar que o autor é idoso (≥ 60 anos).
            </p>
          </div>

          {/* Situação de vulnerabilidade */}
          <div>
            <label className={labelBase}>
              Situação de vulnerabilidade
              <span className="ml-2 text-gray-400 dark:text-slate-500 font-normal">(acréscimo de R$ 1.000 nos danos morais)</span>
            </label>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
              {/* Idoso — calculado automaticamente */}
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  autor.idoso
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                }`}>
                  {autor.idoso ? "✓" : ""}
                </div>
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  Idoso (≥ 60 anos)
                  <span className="ml-1.5 text-[10px] text-gray-400 dark:text-slate-500">calculado da data de nascimento</span>
                </span>
              </div>
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

        </div>
      </section>

      {/* RÉU */}
      <section>
        <h3 className="font-semibold text-gray-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2 mb-4">
          Companhia aérea (Ré)
          <span className="ml-2 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded font-normal align-middle">Obrigatório</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelBase}>
              Companhia aérea
              {camposIA.includes("companhia") && <IaIcon />}
            </label>
            <div className={validarCampos && !dados.companhia ? "ring-1 ring-red-400 rounded-md" : undefined}>
              <SelectCompanhia
                value={dados.companhia ?? ""}
                onChange={(v) => upd({ companhia: v })}
                ia={camposIA.includes("companhia")}
              />
            </div>
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
                  /* Autor reside em SP Capital — foro do domicílio prevalece */
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
                  /* Foro da sede do réu (padrão) */
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
        </div>
      </section>

    </div>
  );
}
