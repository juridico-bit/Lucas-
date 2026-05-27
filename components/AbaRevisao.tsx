"use client";

import { COMPANIAS, CompanhiaKey, COMPANIAS_INTERNACIONAL, CompanhiaInternacionalKey } from "@/lib/companias";
import { DadosFormulario } from "@/lib/types";
import { valorPorExtenso, formatarMoeda } from "@/lib/extenso";
import { calcularAtraso } from "@/lib/calculos";
import { CHECKLIST_ITENS } from "@/components/Checklist";
import { getForoByEndereco } from "@/lib/foros-sp";

interface Props {
  dados: DadosFormulario;
  camposIA: string[];
  onEditar: (secao: string) => void;
  checklist: boolean[];
  onChecklist: (idx: number, val: boolean) => void;
}

/* ── Mini-checkbox inline ─────────────────────────────────── */
function CheckItem({
  idx,
  checklist,
  onChecklist,
}: {
  idx: number;
  checklist: boolean[];
  onChecklist: (idx: number, val: boolean) => void;
}) {
  const marcado = checklist[idx] ?? false;
  return (
    <label
      className={`flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded-lg transition-colors text-xs select-none ${
        marcado
          ? "bg-emerald-50 dark:bg-emerald-950/40"
          : "hover:bg-gray-100 dark:hover:bg-slate-600/40"
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          marcado
            ? "bg-emerald-500 border-emerald-500 text-white scale-105"
            : "border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-700"
        }`}
      >
        {marcado && <span className="text-[9px] font-bold leading-none">✓</span>}
      </span>
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChecklist(idx, e.target.checked)}
        className="sr-only"
      />
      <span
        className={`transition-colors ${
          marcado
            ? "line-through text-gray-400 dark:text-slate-500"
            : "text-gray-600 dark:text-slate-300"
        }`}
      >
        {CHECKLIST_ITENS[idx]}
      </span>
    </label>
  );
}

/* ── Card de seção ────────────────────────────────────────── */
function CardResumo({
  titulo,
  children,
  onEditar,
  checkIdxs,
  checklist,
  onChecklist,
}: {
  titulo: string;
  children: React.ReactNode;
  onEditar: () => void;
  checkIdxs?: number[];
  checklist?: boolean[];
  onChecklist?: (idx: number, val: boolean) => void;
}) {
  return (
    <div className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 dark:text-white text-sm">{titulo}</h4>
        <button
          onClick={onEditar}
          className="text-xs text-blue-700 dark:text-indigo-300 hover:underline font-medium"
        >
          Editar
        </button>
      </div>

      <div className="text-sm text-gray-600 dark:text-slate-200 space-y-1">{children}</div>

      {checkIdxs && checkIdxs.length > 0 && checklist && onChecklist && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-600/60 space-y-0.5">
          {checkIdxs.map((idx) => (
            <CheckItem key={idx} idx={idx} checklist={checklist} onChecklist={onChecklist} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Linha de dado ────────────────────────────────────────── */
function Linha({ label, value, ia = false }: { label: string; value: string; ia?: boolean }) {
  return (
    <div
      className={`flex gap-2 items-center rounded transition-colors ${
        ia ? "border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-900/40 pl-2 py-0.5 -ml-2" : ""
      }`}
    >
      <span className="text-gray-500 dark:text-slate-300 shrink-0 min-w-[120px]">{label}:</span>
      <span className="text-gray-900 dark:text-white font-medium">{value || "—"}</span>
      {ia && (
        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-full ml-1">
          IA
        </span>
      )}
    </div>
  );
}

/* ── Componente principal ─────────────────────────────────── */
export default function AbaRevisao({ dados, camposIA, onEditar, checklist, onChecklist }: Props) {
  const autor = dados.autores?.[0];

  // Resolve companhia em nacional e internacional
  const companhia =
    (dados.companhia ? COMPANIAS[dados.companhia as CompanhiaKey] : null) ??
    (dados.companhia ? COMPANIAS_INTERNACIONAL[dados.companhia as CompanhiaInternacionalKey] : null) ??
    // fallback: tenta por nome_fantasia nas duas tabelas
    Object.values(COMPANIAS).find((c) => c.nome_fantasia.toLowerCase() === (dados.companhia ?? "").toLowerCase()) ??
    Object.values(COMPANIAS_INTERNACIONAL).find((c) => c.nome_fantasia.toLowerCase() === (dados.companhia ?? "").toLowerCase()) ??
    null;

  // Separa foro e comarca ("Foro Regional X da Comarca de Y" → foro + comarca)
  function parseForo(str: string): { foro: string; comarca: string } {
    const sep = / da Comarca de /i;
    const idx = str.search(sep);
    if (idx !== -1) return { foro: str.slice(0, idx).trim(), comarca: str.slice(idx).replace(sep, "").trim() };
    return { foro: "", comarca: str.replace(/^Comarca de /i, "").trim() };
  }

  // Foro do domicílio do autor (SP Capital) sobrepõe o foro da companhia (CDC art. 101, I)
  const autor1Endereco = dados.autores?.[0]?.endereco ?? "";
  const foroAutor = getForoByEndereco(autor1Endereco);
  const { foro: foroDesc, comarca: comarcaNome } = foroAutor
    ? { foro: foroAutor.foroDescricao, comarca: foroAutor.comarca }
    : parseForo(companhia?.comarca ?? "");
  const usandoForoAutor = !!foroAutor;

  const voo1 = dados.voos?.[0];
  const voo2 = dados.voos?.[1];
  const voo3 = dados.voos?.[2];

  const numAutores = Math.max(1, dados.autores?.length ?? 1);
  const valorMoraisPorAutor = parseFloat(dados.valor_morais || "0");
  const valorMoraisTotal = valorMoraisPorAutor * numAutores;
  const valorAlimentacao = parseFloat(dados.valor_alimentacao || "0");
  const valorPassagem = parseFloat(dados.valor_passagem || "0");
  const totalMateriais = valorAlimentacao + valorPassagem;
  const totalCausa = valorMoraisTotal + totalMateriais;

  const qtdMarcados = checklist.filter(Boolean).length;
  const total = checklist.length;
  const progresso = total > 0 ? (qtdMarcados / total) * 100 : 0;

  return (
    <div className="space-y-4">

      {/* Banner IA */}
      <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 rounded-xl p-3 text-sm text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
        <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">IA</span>
        Campos com borda amarela foram preenchidos pela IA. Verifique antes de gerar a peça.
      </div>

      {/* Aviso: campo assistência preenchido mas não vai para a petição */}
      {(dados.assistencia?.length ?? 0) > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>
            O campo <strong>assistências</strong> tem {dados.assistencia!.length} valor(es) preenchido(s)
            ({dados.assistencia!.join(", ")}), mas <strong>não é inserido automaticamente na petição</strong>.
            Mencione as assistências recebidas no relato, se necessário.
          </span>
        </div>
      )}

      {/* Barra de progresso do checklist */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Checklist obrigatório
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {qtdMarcados}/{total} verificados
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progresso}%` }}
          />
        </div>
        {qtdMarcados === total && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="w-4 h-4 bg-emerald-500 rounded-full text-white flex items-center justify-center text-[9px] shrink-0 font-bold">✓</span>
            Todos verificados — pronto para gerar a peça!
          </p>
        )}
      </div>

      {/* Autor */}
      <CardResumo
        titulo="Autor"
        onEditar={() => onEditar("autor")}
        checkIdxs={[1]}
        checklist={checklist}
        onChecklist={onChecklist}
      >
        {dados.id_caso && <Linha label="ID do caso" value={dados.id_caso} />}
        <Linha label="Nome" value={autor?.nome ?? ""} ia={camposIA.includes("autores.0.nome")} />
        <Linha label="Qualificação" value={autor?.qualificacao ?? ""} ia={camposIA.includes("autores.0.qualificacao")} />
      </CardResumo>

      {/* Réu */}
      <CardResumo
        titulo="Réu"
        onEditar={() => onEditar("reu")}
        checkIdxs={[0]}
        checklist={checklist}
        onChecklist={onChecklist}
      >
        <Linha label="Companhia" value={companhia?.nome_fantasia ?? dados.companhia ?? ""} ia={camposIA.includes("companhia")} />
        {companhia?.razao_social && <Linha label="Razão social" value={companhia.razao_social} />}
        {companhia?.cnpj && <Linha label="CNPJ" value={companhia.cnpj} />}
        {companhia?.endereco && <Linha label="Endereço" value={companhia.endereco} />}

        {/* Competência territorial — mostra domicílio do autor ou sede do réu */}
        <div className="mt-2">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Competência territorial
          </span>
          {usandoForoAutor ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-blue-900/30 border border-blue-700/50">
              <span className="text-sm">🏛️</span>
              <div>
                <span className="text-xs font-semibold text-blue-300">Domicílio do autor</span>
                <span className="mx-1.5 text-blue-700/70">·</span>
                <span className="text-[10px] text-blue-500">CDC art. 101, I</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-700/40 border border-slate-600/50">
              <span className="text-sm">🏢</span>
              <span className="text-xs font-semibold text-slate-300">Sede do réu</span>
            </div>
          )}
        </div>

        {foroDesc && <Linha label="Foro" value={foroDesc} />}
        {comarcaNome && <Linha label="Comarca" value={comarcaNome} />}
      </CardResumo>

      {/* Voo 1 */}
      <CardResumo
        titulo="Voo 1"
        onEditar={() => onEditar("voo")}
      >
        <Linha label="Número" value={voo1?.numero ?? ""} ia={camposIA.includes("voos.0.numero")} />
        <Linha label="Origem" value={voo1?.origem_cidade ? `${voo1.origem_cidade}/${voo1.origem_sigla}` : ""} ia={camposIA.includes("voos.0.origem_cidade")} />
        <Linha label="Destino" value={voo1?.destino_cidade ? `${voo1.destino_cidade}/${voo1.destino_sigla}` : ""} ia={camposIA.includes("voos.0.destino_cidade")} />
        <Linha label="Data / Horário" value={voo1?.data ? `${voo1.data} — ${voo1.partida} às ${voo1.chegada}` : ""} ia={camposIA.includes("voos.0.data")} />
      </CardResumo>

      {/* Voo 2 (conexão) */}
      {(dados.tipo_rota === "conexao" || dados.tipo_rota === "2conexoes") && voo2 && (
        <CardResumo titulo="Voo 2 (conexão)" onEditar={() => onEditar("voo")}>
          <Linha label="Número" value={voo2.numero ?? ""} ia={camposIA.includes("voos.1.numero")} />
          <Linha label="Origem" value={voo2.origem_cidade ? `${voo2.origem_cidade}/${voo2.origem_sigla}` : ""} ia={camposIA.includes("voos.1.origem_cidade")} />
          <Linha label="Destino" value={voo2.destino_cidade ? `${voo2.destino_cidade}/${voo2.destino_sigla}` : ""} ia={camposIA.includes("voos.1.destino_cidade")} />
          <Linha label="Data / Horário" value={voo2.data ? `${voo2.data} — ${voo2.partida} às ${voo2.chegada}` : ""} ia={camposIA.includes("voos.1.data")} />
        </CardResumo>
      )}

      {/* Voo 3 (2ª conexão) */}
      {dados.tipo_rota === "2conexoes" && voo3 && (
        <CardResumo titulo="Voo 3 (2ª conexão)" onEditar={() => onEditar("voo")}>
          <Linha label="Número" value={voo3.numero ?? ""} ia={camposIA.includes("voos.2.numero")} />
          <Linha label="Origem" value={voo3.origem_cidade ? `${voo3.origem_cidade}/${voo3.origem_sigla}` : ""} ia={camposIA.includes("voos.2.origem_cidade")} />
          <Linha label="Destino" value={voo3.destino_cidade ? `${voo3.destino_cidade}/${voo3.destino_sigla}` : ""} ia={camposIA.includes("voos.2.destino_cidade")} />
          <Linha label="Data / Horário" value={voo3.data ? `${voo3.data} — ${voo3.partida} às ${voo3.chegada}` : ""} ia={camposIA.includes("voos.2.data")} />
        </CardResumo>
      )}

      {/* Atraso — checklist de voo fica aqui (após todos os voos) */}
      <CardResumo
        titulo="Atraso"
        onEditar={() => onEditar("voo")}
        checkIdxs={[2]}
        checklist={checklist}
        onChecklist={onChecklist}
      >
        <Linha label="Chegada prevista" value={dados.chegada_prevista ?? ""} ia={camposIA.includes("chegada_prevista")} />
        <Linha label="Chegada real" value={dados.chegada_real ?? ""} ia={camposIA.includes("chegada_real")} />
        <Linha
          label="Tempo de atraso"
          value={dados.tempo_atraso || (dados.chegada_prevista && dados.chegada_real
            ? calcularAtraso(dados.chegada_prevista, dados.chegada_real).texto
            : "")}
        />
      </CardResumo>

      {/* Compromisso perdido */}
      {dados.perda_compromisso !== "nao" && (
        <CardResumo
          titulo="Compromisso perdido"
          onEditar={() => onEditar("assistencia")}
          checkIdxs={[3]}
          checklist={checklist}
          onChecklist={onChecklist}
        >
          <Linha label="Tipo" value={dados.perda_compromisso === "profissional" ? "Profissional" : "Pessoal"} />
          <Linha label="Descrição" value={dados.desc_compromisso ?? ""} ia={camposIA.includes("desc_compromisso")} />
          <Linha label="Detalhe" value={dados.desc_compromisso_detalhe ?? ""} ia={camposIA.includes("desc_compromisso_detalhe")} />
        </CardResumo>
      )}

      {/* Quando não há compromisso, item 3 aparece no card de Atraso acima, mas como
          a seção "Compromisso" não existe, precisamos mostrar o item 3 em algum lugar.
          A solução: se perda_compromisso === "nao", não mostramos o card e colocamos
          o item inline no card de Atraso (já feito acima — mas para esse caso específico
          precisamos de um card avulso) */}
      {dados.perda_compromisso === "nao" && (
        <div className="border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-3 bg-white dark:bg-slate-700">
          <CheckItem idx={3} checklist={checklist} onChecklist={onChecklist} />
        </div>
      )}

      {/* Valores */}
      <CardResumo
        titulo="Valores"
        onEditar={() => onEditar("gastos")}
        checkIdxs={[4, 6]}
        checklist={checklist}
        onChecklist={onChecklist}
      >
        <Linha label="Danos morais / autor" value={valorMoraisPorAutor > 0 ? formatarMoeda(valorMoraisPorAutor) : "—"} />
        {numAutores > 1 && <Linha label={`Danos morais total (×${numAutores})`} value={valorMoraisTotal > 0 ? formatarMoeda(valorMoraisTotal) : "—"} />}
        <Linha label="Total materiais" value={totalMateriais > 0 ? formatarMoeda(totalMateriais) : "—"} />
        <Linha label="Valor da causa" value={totalCausa > 0 ? formatarMoeda(totalCausa) : "—"} />
        <Linha label="Causa por extenso" value={totalCausa > 0 ? valorPorExtenso(totalCausa) : "—"} />
      </CardResumo>

      {/* Dados processuais */}
      <CardResumo titulo="Dados processuais" onEditar={() => onEditar("processual")}>
        <Linha label="Data da petição" value={dados.data_peticao ?? ""} />
      </CardResumo>

      {/* Última verificação: relato */}
      <div className="border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-3 bg-white dark:bg-slate-700 space-y-0.5">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Últimas verificações</p>
        <CheckItem idx={5} checklist={checklist} onChecklist={onChecklist} />
      </div>

      {/* Observações internas */}
      {dados.observacoes_internas && (
        <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">📝</span>
            <h4 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Observações internas</h4>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full ml-1">
              Não vai para a petição
            </span>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-wrap">{dados.observacoes_internas}</p>
        </div>
      )}
    </div>
  );
}
