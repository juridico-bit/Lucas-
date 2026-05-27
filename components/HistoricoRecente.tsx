"use client";

import { useEffect, useState } from "react";
import { HistoricoItem } from "@/lib/types";

interface Props {
  onReabrir?: (item: HistoricoItem) => void;
}

export default function HistoricoRecente({ onReabrir }: Props) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  useEffect(() => {
    fetch("/api/historico")
      .then((r) => r.json())
      .then((j: { historico: HistoricoItem[] }) => setHistorico(j.historico ?? []))
      .catch(() => {});
  }, []);

  if (historico.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Histórico</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{historico.length} peça{historico.length !== 1 ? "s" : ""} gerada{historico.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">ID</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Autor</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Módulo</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Companhia</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">Data</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
            {historico.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                <td className="px-4 py-2.5 text-gray-500 dark:text-slate-500 font-mono text-xs">{(item.dados as { id_caso?: string })?.id_caso || "—"}</td>
                <td className="px-4 py-2.5 text-gray-800 dark:text-slate-200 font-medium">{item.autor}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-slate-400">{item.modulo}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-slate-400">{item.companhia}</td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-slate-500">{item.data_geracao}</td>
                <td className="px-4 py-2.5">
                  {onReabrir && (
                    <button onClick={() => onReabrir(item)} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium">
                      Reabrir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
