"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { DadosExtraidos, ConfiancaExtracao } from "@/lib/types";

// ── Tipos de classificação ───────────────────────────────────────────────────

interface ClassificacaoResult {
  tipo: string;
  label: string;
  emoji: string;
  confianca: "alta" | "media" | "baixa";
}

/** Chave estável para identificar um arquivo nesta sessão de upload */
function fileKey(f: File): string {
  return `${f.name}__${f.size}__${f.lastModified}`;
}

// ── ZonaUpload ───────────────────────────────────────────────────────────────

interface ZonaProps {
  label: string;
  obrigatorio: boolean;
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (idx: number) => void;
  classificacoes?: Record<string, ClassificacaoResult>;
  classificandoKeys?: string[];
}

function ZonaUpload({
  label,
  obrigatorio,
  files,
  onAdd,
  onRemove,
  classificacoes = {},
  classificandoKeys = [],
}: ZonaProps) {
  const onDrop = useCallback((accepted: File[]) => onAdd(accepted), [onAdd]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [], "image/*": [] },
    multiple: true,
  });

  return (
    <div className="mb-4">
      {label && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base font-bold text-gray-800 dark:text-slate-100">{label}</span>
          {obrigatorio && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
              Obrigatório
            </span>
          )}
        </div>
      )}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
            : "border-gray-300 dark:border-slate-600 hover:border-indigo-400 bg-gray-50 dark:bg-slate-800"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {isDragActive
            ? "Solte os arquivos aqui..."
            : "Arraste PDF ou imagens, ou clique para selecionar"}
        </p>
      </div>

      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => {
            const sizeMB = f.size / (1024 * 1024);
            const isPdf =
              f.type === "application/pdf" ||
              f.name.toLowerCase().endsWith(".pdf");
            const grande = sizeMB > 8;
            const key = fileKey(f);
            const estaClassificando = classificandoKeys.includes(key);
            const resultado = classificacoes[key];

            return (
              <li
                key={i}
                className={`flex items-center justify-between text-xs rounded px-2 py-1.5 border gap-2 ${
                  grande
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700"
                    : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600"
                }`}
              >
                {/* Lado esquerdo: ícone + nome + tamanho */}
                <span className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                  <span className="shrink-0">{isPdf ? "📄" : "🖼️"}</span>
                  <span className="truncate text-gray-700 dark:text-slate-200">
                    {f.name}
                  </span>
                  <span className="text-gray-400 dark:text-slate-500 shrink-0">
                    {sizeMB < 1
                      ? `${(f.size / 1024).toFixed(0)}KB`
                      : `${sizeMB.toFixed(1)}MB`}
                  </span>
                  {grande && (
                    <span className="text-amber-600 dark:text-amber-400 shrink-0">
                      ⚠ arquivo grande
                    </span>
                  )}
                </span>

                {/* Lado direito: badge de classificação + botão remover */}
                <span className="flex items-center gap-1.5 shrink-0">
                  {estaClassificando ? (
                    <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 animate-pulse">
                      <svg
                        className="h-3 w-3 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      identificando…
                    </span>
                  ) : resultado ? (
                    <span
                      className={`px-1.5 py-0.5 rounded-full font-medium text-xs ${
                        resultado.confianca === "alta"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : resultado.confianca === "media"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {resultado.emoji} {resultado.label}
                    </span>
                  ) : null}

                  <button
                    onClick={() => onRemove(i)}
                    className="text-red-400 hover:text-red-600 font-bold leading-none"
                    type="button"
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── AbaDocumentos ────────────────────────────────────────────────────────────

interface Props {
  onExtraido: (dados: DadosExtraidos, camposIA: string[], confiancas: ConfiancaExtracao) => void;
  apiEndpoint?: string;
  /** Chamado com o tempo total de extração em ms ao concluir */
  onTempoExtracao?: (ms: number) => void;
}

export default function AbaDocumentos({
  onExtraido,
  apiEndpoint = "/api/extrair-dados",
  onTempoExtracao,
}: Props) {
  // Arquivos por zona
  const [bilheteInicial, setBilheteInicial] = useState<File[]>([]);
  const [bilheteRealocado, setBilheteRealocado] = useState<File[]>([]);
  const [gastos, setGastos] = useState<File[]>([]);
  const [compromisso, setCompromisso] = useState<File[]>([]);

  // Textos
  const [relatoTexto, setRelatoTexto] = useState("");
  const [realocadoTexto, setRealocadoTexto] = useState("");
  const [compromissoTexto, setCompromissoTexto] = useState("");

  // Estado de extração
  const [extraindo, setExtraindo] = useState(false);
  const [erro, setErro] = useState("");

  // ── Classificação automática ──────────────────────────────────────────────
  const [classificacoes, setClassificacoes] = useState<
    Record<string, ClassificacaoResult>
  >({});
  const [classificandoKeys, setClassificandoKeys] = useState<string[]>([]);

  async function classificarArquivo(f: File) {
    const key = fileKey(f);
    // Não reclassifica se já tem resultado
    setClassificandoKeys((prev) =>
      prev.includes(key) ? prev : [...prev, key]
    );
    try {
      const fd = new FormData();
      fd.append("file", f);
      const resp = await fetch("/api/classificar-documento", {
        method: "POST",
        body: fd,
      });
      if (resp.ok) {
        const result: ClassificacaoResult = await resp.json();
        setClassificacoes((prev) => ({ ...prev, [key]: result }));
      }
    } catch {
      // falha silenciosa — badge simplesmente não aparece
    } finally {
      setClassificandoKeys((prev) => prev.filter((k) => k !== key));
    }
  }

  function addAndClassify(
    setter: React.Dispatch<React.SetStateAction<File[]>>,
    novos: File[]
  ) {
    setter((prev) => [...prev, ...novos]);
    novos.forEach((f) => classificarArquivo(f));
  }

  function removeAndCleanup(
    setter: React.Dispatch<React.SetStateAction<File[]>>,
    files: File[],
    idx: number
  ) {
    const key = fileKey(files[idx]);
    setter((prev) => prev.filter((_, i) => i !== idx));
    setClassificacoes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // ── Painel de resumo ──────────────────────────────────────────────────────
  const todasClassificadas = Object.values(classificacoes);
  const contagem = todasClassificadas.reduce<
    Record<string, { emoji: string; label: string; n: number }>
  >((acc, c) => {
    if (!acc[c.tipo]) acc[c.tipo] = { emoji: c.emoji, label: c.label, n: 0 };
    acc[c.tipo].n++;
    return acc;
  }, {});
  const tiposEncontrados = Object.values(contagem);
  const temResumo = tiposEncontrados.length > 0;

  // ── Extração ──────────────────────────────────────────────────────────────
  async function handleExtrair() {
    if (bilheteInicial.length === 0) {
      setErro("O bilhete do voo inicial é obrigatório.");
      return;
    }
    setErro("");
    setExtraindo(true);
    const inicioExtracao = Date.now();

    try {
      const fd = new FormData();
      [
        ...bilheteInicial,
        ...bilheteRealocado,
        ...gastos,
        ...compromisso,
      ].forEach((f) => fd.append("files", f));
      if (relatoTexto.trim()) fd.append("relato_texto", relatoTexto.trim());
      if (realocadoTexto.trim())
        fd.append("realocado_texto", realocadoTexto.trim());
      if (compromissoTexto.trim())
        fd.append("compromisso_texto", compromissoTexto.trim());

      const res = await fetch(apiEndpoint, { method: "POST", body: fd });

      if (!res.ok) {
        let msg = `Erro do servidor (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* resposta não era JSON */
        }
        throw new Error(msg);
      }

      const json = (await res.json()) as {
        dados?: DadosExtraidos;
        confiancas?: ConfiancaExtracao;
        error?: string;
      };
      if (json.error) throw new Error(json.error);

      const dados = json.dados!;
      const confiancas: ConfiancaExtracao = json.confiancas ?? {};
      const camposIA: string[] = [];

      if (dados.companhia) camposIA.push("companhia");
      if (dados.tipo_rota) camposIA.push("tipo_rota");
      if (dados.voos?.length) {
        dados.voos.forEach((_, i) => {
          camposIA.push(
            `voos.${i}.numero`,
            `voos.${i}.origem_cidade`,
            `voos.${i}.origem_sigla`,
            `voos.${i}.destino_cidade`,
            `voos.${i}.destino_sigla`,
            `voos.${i}.data`,
            `voos.${i}.dia_semana`,
            `voos.${i}.partida`,
            `voos.${i}.chegada`
          );
        });
      }
      if (dados.voo_realocacao?.numero) {
        camposIA.push(
          "voo_realocacao.numero",
          "voo_realocacao.partida",
          "voo_realocacao.chegada"
        );
      }
      if (dados.chegada_prevista) camposIA.push("chegada_prevista");
      if (dados.chegada_real) camposIA.push("chegada_real");
      if (dados.gastos?.length) camposIA.push("gastos");
      if (dados.relato) camposIA.push("relato");
      if (dados.compromisso_perdido) camposIA.push("desc_compromisso");
      if (dados.compromisso_detalhe) camposIA.push("desc_compromisso_detalhe");

      onExtraido(dados, camposIA, confiancas);
      onTempoExtracao?.(Date.now() - inicioExtracao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setExtraindo(false);
    }
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
        Envie os documentos do caso. O sistema extrairá os dados automaticamente.
        Campos preenchidos pela IA aparecerão destacados em amarelo para verificação.
      </p>

      {/* 1. Relato texto */}
      <div className="mb-4">
        <span className="text-base font-bold text-gray-800 dark:text-slate-100 block mb-1">
          1. Descrição na Resolvvi:
          <span className="ml-2 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded font-normal align-middle">
            Obrigatório
          </span>
        </span>
        <textarea
          value={relatoTexto}
          onChange={(e) => setRelatoTexto(e.target.value)}
          rows={6}
          placeholder="Cole aqui a descrição/relato da Resolvvi..."
          className="w-full border-2 border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      {/* 2. Bilhetes */}
      <div className="mb-5">
        <span className="text-base font-bold text-gray-800 dark:text-slate-100 block mb-3">
          2. Bilhetes eletrônicos:
        </span>
        <div className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-3">
          <ZonaUpload
            label="Voo inicial"
            obrigatorio
            files={bilheteInicial}
            onAdd={(novos) => addAndClassify(setBilheteInicial, novos)}
            onRemove={(idx) =>
              removeAndCleanup(setBilheteInicial, bilheteInicial, idx)
            }
            classificacoes={classificacoes}
            classificandoKeys={classificandoKeys}
          />
          <div>
            <ZonaUpload
              label="Novo voo (realocado)"
              obrigatorio
              files={bilheteRealocado}
              onAdd={(novos) => addAndClassify(setBilheteRealocado, novos)}
              onRemove={(idx) =>
                removeAndCleanup(setBilheteRealocado, bilheteRealocado, idx)
              }
              classificacoes={classificacoes}
              classificandoKeys={classificandoKeys}
            />
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1 mt-2">
              ou descreva em texto:
            </p>
            <textarea
              value={realocadoTexto}
              onChange={(e) => setRealocadoTexto(e.target.value)}
              rows={3}
              placeholder="Ex: Realocado no voo 4502, saindo às 21h30 de GRU com chegada às 23h15 em FOR..."
              className="w-full border-2 border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>
        </div>
      </div>

      {/* 3. Gastos */}
      <ZonaUpload
        label="3. Comprovantes de gastos:"
        obrigatorio={false}
        files={gastos}
        onAdd={(novos) => addAndClassify(setGastos, novos)}
        onRemove={(idx) => removeAndCleanup(setGastos, gastos, idx)}
        classificacoes={classificacoes}
        classificandoKeys={classificandoKeys}
      />

      {/* 4. Perda de compromisso */}
      <div className="mb-4">
        <span className="text-base font-bold text-gray-800 dark:text-slate-100 block mb-2">
          4. Comprovante de perda de compromisso:
        </span>
        <ZonaUpload
          label=""
          obrigatorio={false}
          files={compromisso}
          onAdd={(novos) => addAndClassify(setCompromisso, novos)}
          onRemove={(idx) =>
            removeAndCleanup(setCompromisso, compromisso, idx)
          }
          classificacoes={classificacoes}
          classificandoKeys={classificandoKeys}
        />
        <p className="text-xs text-gray-500 dark:text-slate-100 mb-1 mt-1">
          ou descreva em texto:
        </p>
        <textarea
          value={compromissoTexto}
          onChange={(e) => setCompromissoTexto(e.target.value)}
          rows={4}
          placeholder="Descreva a perda do compromisso (evento, data, prejuízo)..."
          className="w-full border-2 border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      {/* ── Painel de resumo de classificação ── */}
      {temResumo && (
        <div className="mb-4 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-400 mr-1">
            📋 Reconhecido:
          </span>
          {tiposEncontrados.map(({ emoji, label, n }, i) => (
            <span key={i} className="text-slate-700 dark:text-slate-300">
              {i > 0 && (
                <span className="mx-1.5 text-slate-300 dark:text-slate-600">
                  ·
                </span>
              )}
              {emoji} {label}
              {n > 1 && (
                <span className="ml-0.5 text-slate-400 dark:text-slate-500">
                  ({n})
                </span>
              )}
            </span>
          ))}
          {classificandoKeys.length > 0 && (
            <span className="ml-2 text-slate-400 animate-pulse">
              + {classificandoKeys.length} identificando…
            </span>
          )}
        </div>
      )}

      {/* ── Erro ── */}
      {erro && (
        <div className="mb-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-red-700 dark:text-red-400 text-sm mb-2">⚠ {erro}</p>
          <button
            type="button"
            onClick={handleExtrair}
            className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded transition-colors"
          >
            ↺ Tentar novamente
          </button>
        </div>
      )}

      {/* ── Botão de extração ── */}
      <button
        onClick={handleExtrair}
        disabled={extraindo}
        className="w-full py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {extraindo ? "Extraindo dados..." : "Extrair Dados com IA"}
      </button>
    </div>
  );
}
