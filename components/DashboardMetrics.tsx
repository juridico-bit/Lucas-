"use client";

import { useEffect, useState } from "react";
import { HistoricoItem } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function parseDataBR(s: string): Date | null {
  const p = s?.split("/");
  if (!p || p.length !== 3) return null;
  const d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  return isNaN(d.getTime()) ? null : d;
}

function parseValorMorais(s?: string): number {
  if (!s) return 0;
  // "R$ 9.500,00"  →  9500
  // "9500"         →  9500
  const clean = s
    .replace(/R\$\s*/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function formatarMoeda(valor: number): string {
  if (valor <= 0) return "—";
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatarTempoMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}min`;
}

// ── Métricas calculadas ────────────────────────────────────────────────────

interface Metricas {
  // Este mês
  totalMes: number;
  nacionaisMes: number;
  internacionaisMes: number;
  tendenciaMes: number;      // % vs mês anterior
  // Valores
  valorMedioMes: number;
  // Companhias do mês
  companhiasMes: { nome: string; count: number }[];
  // Outros
  tempoMedioMs: number | null;
  totalGeral: number;
  estaSemana: number;
  ultimaGeracao: string;
  mesNome: string;
  anoAtual: number;
}

function calcular(historico: HistoricoItem[]): Metricas {
  const agora = new Date();
  const mesAtual  = agora.getMonth();
  const anoAtual  = agora.getFullYear();
  const mesAnt    = mesAtual === 0 ? 11 : mesAtual - 1;
  const anoAnt    = mesAtual === 0 ? anoAtual - 1 : anoAtual;
  const semanaAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

  const doMes = historico.filter((h) => {
    const d = parseDataBR(h.data_geracao);
    return d && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const doMesAnt = historico.filter((h) => {
    const d = parseDataBR(h.data_geracao);
    return d && d.getMonth() === mesAnt && d.getFullYear() === anoAnt;
  });

  const estaSemana = historico.filter((h) => {
    const d = parseDataBR(h.data_geracao);
    return d && d >= semanaAtras;
  }).length;

  // Por módulo
  const nacionaisMes      = doMes.filter((h) => h.modulo.toLowerCase().includes("nacional")).length;
  const internacionaisMes = doMes.filter((h) => h.modulo.toLowerCase().includes("internac")).length;

  // Companhias do mês
  const contComp: Record<string, number> = {};
  doMes.forEach((h) => {
    if (h.companhia) contComp[h.companhia] = (contComp[h.companhia] ?? 0) + 1;
  });
  const companhiasMes = Object.entries(contComp)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nome, count]) => ({ nome, count }));

  // Valor médio (todos com valor > 0 no mês)
  const valores = doMes
    .map((h) => parseValorMorais((h.dados as { valor_morais?: string })?.valor_morais))
    .filter((v) => v > 0);
  const valorMedioMes =
    valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

  // Tempo médio de extração (todos os que têm o campo)
  const tempos = historico
    .map((h) => h.tempo_extracao_ms)
    .filter((t): t is number => typeof t === "number" && t > 0);
  const tempoMedioMs =
    tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;

  // Tendência vs mês anterior
  const tendenciaMes =
    doMesAnt.length > 0
      ? Math.round(((doMes.length - doMesAnt.length) / doMesAnt.length) * 100)
      : doMes.length > 0
      ? 100
      : 0;

  return {
    totalMes: doMes.length,
    nacionaisMes,
    internacionaisMes,
    tendenciaMes,
    valorMedioMes,
    companhiasMes,
    tempoMedioMs,
    totalGeral: historico.length,
    estaSemana,
    ultimaGeracao: historico[0]?.data_geracao ?? "—",
    mesNome: MESES[mesAtual],
    anoAtual,
  };
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  subColor = "text-slate-400 dark:text-slate-500",
  accent = "border-slate-200 dark:border-slate-700",
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  accent?: string;
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 border rounded-xl p-4 flex flex-col gap-1 transition-transform hover:-translate-y-0.5 ${accent}`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">
          {label}
        </span>
        <span className="text-lg leading-none">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
        {value}
      </p>
      {sub && <p className={`text-xs font-medium mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  );
}

function Tendencia({ valor, mesAnt }: { valor: number; mesAnt: string }) {
  if (valor > 0)
    return (
      <span className="text-emerald-600 dark:text-emerald-400">
        ↑ {valor}% vs {mesAnt}
      </span>
    );
  if (valor < 0)
    return (
      <span className="text-red-500 dark:text-red-400">
        ↓ {Math.abs(valor)}% vs {mesAnt}
      </span>
    );
  return (
    <span className="text-slate-400 dark:text-slate-500">→ igual a {mesAnt}</span>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <span className="text-base leading-none">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {value}
      </span>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function DashboardMetrics() {
  const [m, setM] = useState<Metricas | null>(null);

  useEffect(() => {
    fetch("/api/historico")
      .then((r) => r.json())
      .then((j: { historico: HistoricoItem[] }) =>
        setM(calcular(j.historico ?? []))
      )
      .catch(() => setM(calcular([])));
  }, []);

  // Skeleton enquanto carrega
  if (!m) {
    return (
      <section className="mb-10 animate-pulse">
        <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-52 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="lg:col-span-2 h-52 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      </section>
    );
  }

  const agora  = new Date();
  const mesAnt = MESES[agora.getMonth() === 0 ? 11 : agora.getMonth() - 1];
  const maxComp = m.companhiasMes[0]?.count ?? 1;

  // Construção da string de tendência para o KpiCard (como texto puro)
  function tendenciaTexto(): { txt: string; cor: string } {
    if (m!.tendenciaMes > 0)
      return {
        txt: `↑ ${m!.tendenciaMes}% vs ${mesAnt}`,
        cor: "text-emerald-600 dark:text-emerald-400",
      };
    if (m!.tendenciaMes < 0)
      return {
        txt: `↓ ${Math.abs(m!.tendenciaMes)}% vs ${mesAnt}`,
        cor: "text-red-500 dark:text-red-400",
      };
    return {
      txt: `→ igual a ${mesAnt}`,
      cor: "text-slate-400 dark:text-slate-500",
    };
  }
  const tend = tendenciaTexto();

  return (
    <section className="mb-10">
      {/* Cabeçalho */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Dashboard
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {m.mesNome} {m.anoAtual}
            {m.totalGeral > 0 && (
              <span className="ml-2 text-slate-400">
                · {m.totalGeral} peça{m.totalGeral !== 1 ? "s" : ""} no total
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <KpiCard
          icon="📄"
          label="Peças este mês"
          value={m.totalMes}
          sub={m.totalGeral > 0 ? tend.txt : "Nenhuma peça ainda"}
          subColor={m.totalGeral > 0 ? tend.cor : "text-slate-400"}
          accent="border-indigo-100 dark:border-indigo-900"
        />
        <KpiCard
          icon="✈️"
          label="Voo Nacional"
          value={m.nacionaisMes}
          sub={
            m.totalMes > 0
              ? `${Math.round((m.nacionaisMes / m.totalMes) * 100)}% do mês`
              : undefined
          }
          accent="border-sky-100 dark:border-sky-900"
        />
        <KpiCard
          icon="🌍"
          label="Internacional"
          value={m.internacionaisMes}
          sub={
            m.totalMes > 0
              ? `${Math.round((m.internacionaisMes / m.totalMes) * 100)}% do mês`
              : undefined
          }
          accent="border-violet-100 dark:border-violet-900"
        />
      </div>

      {/* ── Painel inferior: Ranking + Stats ── */}
      {m.totalGeral > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Ranking de companhias */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
              Companhias mais acionadas
              <span className="ml-2 text-xs font-normal text-slate-400">
                este mês
              </span>
            </h3>

            {m.companhiasMes.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Nenhuma peça gerada este mês.
              </p>
            ) : (
              <div className="space-y-3">
                {m.companhiasMes.map(({ nome, count }, i) => {
                  const pct = Math.round((count / m.totalMes) * 100);
                  const barW = Math.max(4, Math.round((count / maxComp) * 100));
                  return (
                    <div key={nome} className="flex items-center gap-3">
                      {/* Posição */}
                      <span className="w-5 text-xs text-center font-bold text-slate-400 dark:text-slate-500 shrink-0">
                        {i + 1}
                      </span>
                      {/* Nome */}
                      <span className="w-28 text-sm font-medium text-slate-700 dark:text-slate-200 truncate shrink-0">
                        {nome}
                      </span>
                      {/* Barra */}
                      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-500"
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                      {/* Contagem + % */}
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0 w-14 text-right">
                        {count} <span className="font-normal text-slate-400">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats adicionais */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Outros indicadores
            </h3>
            <div>
              <StatRow
                icon="⏱"
                label="Tempo médio de extração"
                value={
                  m.tempoMedioMs !== null
                    ? formatarTempoMs(m.tempoMedioMs)
                    : "em coleta…"
                }
              />
              <StatRow icon="📅" label="Esta semana" value={m.estaSemana} />
              <StatRow icon="📄" label="Total geral" value={m.totalGeral} />
              <StatRow
                icon="🕐"
                label="Última geração"
                value={m.ultimaGeracao}
              />
              {m.companhiasMes.length > 0 && (
                <StatRow
                  icon="✈️"
                  label="Companhia líder"
                  value={m.companhiasMes[0].nome}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {m.totalGeral === 0 && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
          Nenhuma peça gerada ainda. As métricas aparecerão após a primeira geração.
        </div>
      )}
    </section>
  );
}
