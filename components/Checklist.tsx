"use client";

const ITENS = [
  "Verifiquei se o endereçamento está correto",
  "Verifiquei o nome, CPF e endereço do autor",
  "Verifiquei o número do voo e horários",
  "Verifiquei a perda de compromisso",
  "Verifiquei os gastos extras",
  "Verifiquei a descrição/relato do cliente",
  "Verifiquei o valor da causa e o extenso",
];

interface ChecklistProps {
  marcados: boolean[];
  onChange: (idx: number, valor: boolean) => void;
}

export default function Checklist({ marcados, onChange }: ChecklistProps) {
  const qtdMarcados = marcados.filter(Boolean).length;
  const total = marcados.length;
  const progresso = (qtdMarcados / total) * 100;

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Checklist obrigatório</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">{qtdMarcados}/{total} verificados</span>
      </div>

      {/* Barra de progresso animada */}
      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progresso}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {ITENS.map((item, idx) => (
          <label
            key={idx}
            className={`flex items-center gap-3 cursor-pointer select-none px-3 py-2 rounded-xl transition-all duration-200 ${
              marcados[idx]
                ? "bg-emerald-50 dark:bg-emerald-950/40"
                : "hover:bg-slate-100 dark:hover:bg-slate-700/50"
            }`}
          >
            {/* Custom checkbox */}
            <span
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                marcados[idx]
                  ? "bg-emerald-500 border-emerald-500 text-white scale-110"
                  : "border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700"
              }`}
            >
              {marcados[idx] && <span className="text-[10px] font-bold leading-none">✓</span>}
            </span>
            <input
              type="checkbox"
              checked={marcados[idx] ?? false}
              onChange={(e) => onChange(idx, e.target.checked)}
              className="sr-only"
            />
            <span
              className={`text-sm transition-all duration-200 ${
                marcados[idx]
                  ? "text-slate-400 dark:text-slate-500 line-through"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {item}
            </span>
          </label>
        ))}
      </div>

      {marcados.every(Boolean) && (
        <div className="mt-4 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 animate-pulse-once">
          <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs shrink-0 font-bold">✓</span>
          Todos verificados — pronto para gerar a peça!
        </div>
      )}
    </div>
  );
}

export { ITENS as CHECKLIST_ITENS };
