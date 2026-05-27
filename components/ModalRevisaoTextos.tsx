"use client";

import { useEffect } from "react";

export interface RevisaoTextos {
  relato_original: string;
  relato_reescrito: string;
  compromisso_original: string;
  compromisso_reescrito: string;
  detalhe_original: string;
  detalhe_reescrito: string;
}

interface Props {
  docxBase64: string;
  nomeArquivo: string;
  revisoes: RevisaoTextos;
  onClose: () => void;
}

function baixarDocx(base64: string, nomeArquivo: string) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoga após 2 min para garantir que o browser terminou de ler o blob
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

function BlocoRevisao({
  titulo,
  original,
  reescrito,
}: {
  titulo: string;
  original: string;
  reescrito: string;
}) {
  if (!original && !reescrito) return null;
  const mudou = original.trim() !== reescrito.trim();

  return (
    <div className="border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden">
      {/* Cabeçalho do bloco */}
      <div className="px-4 py-2.5 bg-gray-50 dark:bg-slate-700/70 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-slate-200">{titulo}</h3>
        {mudou ? (
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
            IA reescreveu
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-600 px-2 py-0.5 rounded-full">
            Sem alteração
          </span>
        )}
      </div>

      {/* Colunas antes / depois */}
      <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-slate-600">
        <div className="p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-2">
            Você digitou
          </p>
          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {original || <span className="italic text-gray-300 dark:text-slate-600">Vazio</span>}
          </p>
        </div>
        <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-2">
            Texto na petição
          </p>
          <p className="text-xs text-gray-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
            {reescrito || <span className="italic text-gray-300 dark:text-slate-600">Vazio</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ModalRevisaoTextos({
  docxBase64,
  nomeArquivo,
  revisoes,
  onClose,
}: Props) {
  // Fecha ao pressionar Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const temAlgumConteudo =
    revisoes.relato_original ||
    revisoes.relato_reescrito ||
    revisoes.compromisso_original ||
    revisoes.compromisso_reescrito ||
    revisoes.detalhe_original ||
    revisoes.detalhe_reescrito;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Painel */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Cabeçalho */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-600 flex items-start justify-between shrink-0 gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full">IA</span>
              Revisar texto antes de baixar
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Confira o que a IA reescreveu para linguagem jurídica. O documento já está pronto.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors text-xl leading-none p-1 shrink-0 mt-0.5"
            title="Fechar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {temAlgumConteudo ? (
            <>
              {(revisoes.relato_original || revisoes.relato_reescrito) && (
                <BlocoRevisao
                  titulo="Relato dos fatos"
                  original={revisoes.relato_original}
                  reescrito={revisoes.relato_reescrito}
                />
              )}
              {(revisoes.compromisso_original || revisoes.compromisso_reescrito) && (
                <BlocoRevisao
                  titulo="Compromisso perdido"
                  original={revisoes.compromisso_original}
                  reescrito={revisoes.compromisso_reescrito}
                />
              )}
              {(revisoes.detalhe_original || revisoes.detalhe_reescrito) && (
                <BlocoRevisao
                  titulo="Detalhe do compromisso"
                  original={revisoes.detalhe_original}
                  reescrito={revisoes.detalhe_reescrito}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-10 italic">
              Nenhum campo de texto livre foi preenchido neste caso.
            </p>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-600 flex items-center justify-between gap-3 shrink-0 bg-gray-50/60 dark:bg-slate-800/60 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-white border border-gray-300 dark:border-slate-600 rounded-lg transition-colors"
          >
            Fechar sem baixar
          </button>
          <button
            onClick={() => {
              baixarDocx(docxBase64, nomeArquivo);
              onClose();
            }}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-sm transition-colors shadow-sm shadow-indigo-200 flex items-center gap-2"
          >
            <span>⬇</span>
            Baixar Petição .docx
          </button>
        </div>
      </div>
    </div>
  );
}
