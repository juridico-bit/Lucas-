"use client";

/**
 * QueueIndicator — indicador de status da fila de processamento de IA.
 *
 * Aparece no cabeçalho das páginas quando há tarefas em andamento ou aguardando.
 * Fica invisível quando a fila está ociosa (running=0, waiting=0).
 *
 * Polling: a cada POLL_MS quando ativo, pausa quando ocioso.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { QueueStats } from "@/lib/ai-queue";

const POLL_ACTIVE_MS  = 1_500; // intervalo enquanto há atividade
const POLL_IDLE_MS    = 5_000; // intervalo quando ocioso (verificação periódica)

export default function QueueIndicator() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [erro, setErro] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/queue-status", { cache: "no-store" });
      if (!res.ok) throw new Error("status não ok");
      const data = (await res.json()) as QueueStats;
      setStats(data);
      setErro(false);
      return data;
    } catch {
      setErro(true);
      return null;
    }
  }, []);

  const schedule = useCallback(
    (data: QueueStats | null) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const busy = data && (data.running > 0 || data.waiting > 0);
      timerRef.current = setTimeout(() => {
        fetchStats().then(schedule);
      }, busy ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    },
    [fetchStats],
  );

  useEffect(() => {
    fetchStats().then(schedule);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchStats, schedule]);

  // Nada a mostrar quando ocioso ou com erro silencioso
  if (!stats || erro) return null;
  if (stats.running === 0 && stats.waiting === 0) return null;

  const isWaiting = stats.waiting > 0;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-all duration-300 ${
        isWaiting
          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
          : "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
      }`}
      title={`Fila IA — ${stats.running} processando, ${stats.waiting} aguardando`}
    >
      {/* Spinner animado */}
      <span
        className={`inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0 ${
          isWaiting
            ? "border-amber-500 dark:border-amber-400"
            : "border-indigo-500 dark:border-indigo-400"
        }`}
      />

      {isWaiting ? (
        <span>
          IA — <strong>{stats.running}</strong> processando
          {stats.waiting > 0 && (
            <> · <strong>{stats.waiting}</strong> na fila</>
          )}
        </span>
      ) : (
        <span>
          IA — <strong>{stats.running}</strong> processando
        </span>
      )}
    </div>
  );
}
