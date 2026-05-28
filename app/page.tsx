import Link from "next/link";
import HistoricoRecente from "@/components/HistoricoRecente";
import DashboardMetrics from "@/components/DashboardMetrics";
import ThemeToggle from "@/components/ThemeToggle";

const CATEGORIAS = [
  {
    id: "consumidor",
    titulo: "Consumidor",
    descricao: "Direito do Consumidor",
    icone: "⚖️",
    modulos: [
      {
        titulo: "Voo Nacional",
        subtitulo: "1 Autor",
        descricao: "Petição inicial para atraso ou cancelamento de voo doméstico com 1 autor",
        href: "/voo-nacional",
        icone: "✈️",
      },
      {
        titulo: "Voo Internacional",
        subtitulo: "1 Autor",
        descricao: "Petição inicial para atraso ou cancelamento de voo internacional com 1 autor",
        href: "/voo-internacional-1-autor",
        icone: "🌐",
      },
      {
        titulo: "Voo Internacional",
        subtitulo: "2 ou mais autores",
        descricao: "Petição inicial para atraso ou cancelamento de voo internacional com 2 ou mais autores",
        href: "/voo-internacional",
        icone: "🌍",
      },
    ],
    modulos_breve: [
      { titulo: "Voo Nacional — Múltiplos Autores", icone: "👥" },
      { titulo: "Negativação Indevida", icone: "🚫" },
      { titulo: "Réplica", icone: "⚖️" },
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">

      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
              LMC
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">LMC Advogados</h1>
              <p className="text-slate-400 text-xs">Sistema de Petições</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Sistema online
            </span>
            <ThemeToggle />
            <Link
              href="/admin"
              className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-slate-800"
            >
              ⚙ Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Métricas */}
        <DashboardMetrics />

        {/* Módulos */}
        <div className="mb-10">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Módulos</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Selecione o tipo de caso para iniciar</p>
            </div>
          </div>

          <div className="space-y-8">
            {CATEGORIAS.map((categoria) => {
              const totalAtivos = categoria.modulos.length;
              return (
                <div key={categoria.id}>

                  {/* Cabeçalho da categoria */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-base">
                        {categoria.icone}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">
                          {categoria.titulo}
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">
                          {categoria.descricao}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700 ml-2" />
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {totalAtivos} ativo{totalAtivos !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Grid de módulos ativos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {categoria.modulos.map((m) => (
                      <Link
                        key={m.href}
                        href={m.href}
                        className="group relative block rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-white dark:bg-slate-800 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200 hover:-translate-y-0.5"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <span className="text-3xl">{m.icone}</span>
                          <span className="text-xs font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-full">
                            Disponível
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors text-sm leading-tight">
                          {m.titulo}
                          {m.subtitulo && (
                            <span className="ml-1.5 text-xs font-bold text-slate-700 dark:text-white">
                              — {m.subtitulo}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed mt-1">{m.descricao}</p>
                        <div className="mt-4 flex items-center gap-1 text-indigo-600 text-xs font-semibold group-hover:gap-2 transition-all">
                          Abrir módulo <span>→</span>
                        </div>
                      </Link>
                    ))}

                    {/* Módulos em breve dentro da categoria */}
                    {categoria.modulos_breve.map((m) => (
                      <div
                        key={m.titulo}
                        className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/40 p-6 cursor-not-allowed"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <span className="text-3xl opacity-40">{m.icone}</span>
                          <span className="text-xs font-semibold bg-slate-100 text-slate-400 px-2.5 py-1 rounded-full">
                            Em breve
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-400 text-sm">{m.titulo}</h4>
                      </div>
                    ))}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* Histórico */}
        <HistoricoRecente />

      </main>
    </div>
  );
}
