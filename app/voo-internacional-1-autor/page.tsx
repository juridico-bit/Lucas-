"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AbaDocumentos from "@/components/AbaDocumentos";
import AbaFormulario from "@/components/AbaFormulario";
import PainelConsultaVoo from "@/components/PainelConsultaVoo";
import AbaQualificacaoInternacional from "@/components/AbaQualificacaoInternacional";
import AbaRevisao from "@/components/AbaRevisao";
import ModalRevisaoTextos, { RevisaoTextos } from "@/components/ModalRevisaoTextos";
import { CHECKLIST_ITENS } from "@/components/Checklist";
import { DadosFormulario, DadosExtraidos, HistoricoItem, ConfiancaExtracao } from "@/lib/types";
import { dataAtual, calcularAtraso, calcularAtrasoMinutos, sugerirValorMorais } from "@/lib/calculos";
import { valorPorExtenso } from "@/lib/extenso";
import { COMPANIAS_INTERNACIONAL, CompanhiaInternacionalKey } from "@/lib/companias";
import { v4 as uuidv4 } from "uuid";
import ThemeToggle from "@/components/ThemeToggle";
import RevisaoExpressa from "@/components/RevisaoExpressa";
import QueueIndicator from "@/components/QueueIndicator";

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

const DADOS_INICIAIS: DadosFormulario = {
  template: "voo-internacional-1-autor",
  num_autores: 1,
  autores: [{ ...AUTOR_VAZIO }],
  companhia: "",
  tipo_rota: "direto",
  voos: [
    { numero: "", origem_cidade: "", origem_sigla: "", destino_cidade: "", destino_sigla: "", data: "", dia_semana: "", partida: "", chegada: "" },
    { numero: "", origem_cidade: "", origem_sigla: "", destino_cidade: "", destino_sigla: "", data: "", dia_semana: "", partida: "", chegada: "" },
    { numero: "", origem_cidade: "", origem_sigla: "", destino_cidade: "", destino_sigla: "", data: "", dia_semana: "", partida: "", chegada: "" },
  ],
  voo_realocacao: { numero: "", origem_cidade: "", destino_cidade: "", data: "", dia_semana: "", partida: "", chegada: "" },
  chegada_prevista: "",
  chegada_real: "",
  tempo_atraso: "",
  tempo_atraso_simples: "",
  assistencia: [],
  perda_compromisso: "nao",
  desc_compromisso: "",
  desc_compromisso_detalhe: "",
  gestante_bebe: "nao",
  condicao_especial: false,
  recebeu_hospedagem: false,
  tem_gastos: false,
  gastos: [],
  valor_morais: "",
  valor_morais_extenso: "",
  valor_alimentacao: "",
  valor_passagem: "",
  relato: "",
  particularidade: "",
  id_caso: "",
  data_peticao: dataAtual(),
  observacoes_internas: "",
};

const RASCUNHO_KEY = "rascunho_voo_internacional_1_autor";

type Aba = "qualificacao" | "documentos" | "formulario" | "revisao";

const STEPS: { id: Aba; label: string; desc: string; num: number }[] = [
  { id: "qualificacao", label: "Qualificação", desc: "Autor e companhia aérea", num: 1 },
  { id: "documentos", label: "Documentos", desc: "Envie os arquivos do caso", num: 2 },
  { id: "formulario", label: "Formulário", desc: "Confira e complete os dados", num: 3 },
  { id: "revisao", label: "Revisão & Geração", desc: "Checklist e download", num: 4 },
];

async function salvarHistorico(dados: DadosFormulario, tempoExtracaoMs?: number) {
  const autoresNomes = (dados.autores ?? [])
    .map((a) => a.nome)
    .filter(Boolean)
    .join(", ");
  const novo: HistoricoItem = {
    id: uuidv4(),
    modulo: "Voo Internacional — 1 Autor",
    autor: autoresNomes || "Desconhecido",
    companhia: dados.companhia ?? "",
    data_geracao: dataAtual(),
    dados,
    ...(tempoExtracaoMs != null && { tempo_extracao_ms: tempoExtracaoMs }),
  };
  try {
    await fetch("/api/historico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novo),
    });
  } catch { /* silencioso */ }
}

export default function VooInternacional1AutorPage() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("qualificacao");
  const [dados, setDados] = useState<DadosFormulario>(DADOS_INICIAIS);
  const [camposIA, setCamposIA] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<boolean[]>(Array(CHECKLIST_ITENS.length).fill(false));
  const [gerando, setGerando] = useState(false);
  const [etapaGeracao, setEtapaGeracao] = useState<string>("");
  const [erro, setErro] = useState("");
  const [modalRevisao, setModalRevisao] = useState<{
    docxBase64: string;
    nomeArquivo: string;
    revisoes: RevisaoTextos;
  } | null>(null);
  const [rascunhoDisponivel, setRascunhoDisponivel] = useState(false);
  const [errosValidacao, setErrosValidacao] = useState<string[]>([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [moraisConfirmado, setMoraisConfirmado] = useState(false);
  const [validarCampos, setValidarCampos] = useState(false);
  const [tempoExtracaoMs, setTempoExtracaoMs] = useState<number | undefined>(undefined);
  const [confiancas, setConfiancas] = useState<ConfiancaExtracao>({});
  const [linkRascunho, setLinkRascunho] = useState<string | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [bannerRascunhoCloud, setBannerRascunhoCloud] = useState(false);
  const [extracaoConcluida, setExtracaoConcluida] = useState<{
    companhia: string; voo: string; atraso: string; valorSugerido: string;
  } | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reseta confirmação quando danos morais mudam
  useEffect(() => {
    setMoraisConfirmado(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados.valor_morais]);

  // Recalcula extenso dos danos morais
  useEffect(() => {
    const v = parseFloat(dados.valor_morais || "0");
    const ext = v > 0 ? valorPorExtenso(v) : "";
    setDados((prev) => {
      if (prev.valor_morais_extenso === ext) return prev;
      return { ...prev, valor_morais_extenso: ext };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados.valor_morais]);

  // Recalcula tempo de atraso
  useEffect(() => {
    const atraso = calcularAtraso(dados.chegada_prevista ?? "", dados.chegada_real ?? "");
    if (!atraso.texto) return;
    setDados((prev) => {
      if (prev.tempo_atraso === atraso.texto) return prev;
      return { ...prev, tempo_atraso: atraso.texto, tempo_atraso_simples: atraso.simples };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados.chegada_prevista, dados.chegada_real]);

  // Sugestão automática de danos morais
  useEffect(() => {
    if (moraisConfirmado) return;
    const atrasoMin = calcularAtrasoMinutos(dados.chegada_prevista ?? "", dados.chegada_real ?? "");
    if (atrasoMin < 240) return;
    const perdaComp = dados.perda_compromisso !== "nao" ? dados.perda_compromisso : "nao";
    const algumIdoso = (dados.autores ?? []).some((a) => a.idoso);
    const vulneravel = algumIdoso || dados.gestante_bebe !== "nao" || (dados.condicao_especial ?? false);
    const recebeHospedagem = dados.recebeu_hospedagem ?? false;
    const sugerido = sugerirValorMorais(atrasoMin, perdaComp, vulneravel, recebeHospedagem);
    if (!sugerido) return;
    setDados((prev) => ({ ...prev, valor_morais: sugerido }));
    setCamposIA((prev) => prev.includes("valor_morais") ? prev : [...prev, "valor_morais"]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dados.chegada_prevista, dados.chegada_real, dados.perda_compromisso,
    dados.gestante_bebe, dados.condicao_especial, dados.recebeu_hospedagem,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify((dados.autores ?? []).map((a) => a.idoso)),
  ]);

  // Atalhos de teclado
  useEffect(() => {
    const ABA_ORDER: Aba[] = ["qualificacao", "documentos", "formulario", "revisao"];

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;

      if (e.ctrlKey && e.key === "Enter") {
        if (aba === "formulario") avancarParaRevisao();
        else if (aba === "revisao" && checklist.every(Boolean) && !gerando) gerarPeca();
      }

      if (e.ctrlKey && e.key === "g" && aba === "revisao") {
        e.preventDefault();
        if (checklist.every(Boolean) && !gerando) gerarPeca();
      }

      if (e.key === "Escape") setMostrarPreview(false);

      if (
        e.key === "Enter" &&
        !e.ctrlKey && !e.shiftKey && !e.altKey &&
        tag !== "TEXTAREA" && tag !== "SELECT" && tag !== "BUTTON"
      ) {
        if (aba === "qualificacao") {
          e.preventDefault();
          setAba("documentos");
        } else if (aba === "documentos") {
          e.preventDefault();
          setAba("formulario");
        } else if (aba === "formulario") {
          e.preventDefault();
          avancarParaRevisao();
        } else if (aba === "revisao" && checklist.every(Boolean) && !gerando) {
          e.preventDefault();
          gerarPeca();
        }
      }

      if (e.ctrlKey && e.key === "ArrowRight") {
        e.preventDefault();
        const idx = ABA_ORDER.indexOf(aba);
        if (idx < ABA_ORDER.length - 1) {
          if (aba === "formulario") avancarParaRevisao();
          else setAba(ABA_ORDER[idx + 1]);
        }
      }

      if (e.ctrlKey && e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = ABA_ORDER.indexOf(aba);
        if (idx > 0) setAba(ABA_ORDER[idx - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, checklist, gerando]);

  // Detecta rascunho local ao montar
  useEffect(() => {
    const raw = localStorage.getItem(RASCUNHO_KEY);
    if (!raw) return;
    try {
      const salvo = JSON.parse(raw) as { dados: DadosFormulario; camposIA: string[] };
      if (salvo.dados?.autores?.[0]?.nome) setRascunhoDisponivel(true);
    } catch { /* ignore */ }
  }, []);

  // Detecta rascunho compartilhado via URL (?rascunho=ID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("rascunho");
    if (!id) return;
    fetch(`/api/rascunho?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.dados) return;
        setDados(data.dados as DadosFormulario);
        if (Array.isArray(data.camposIA)) setCamposIA(data.camposIA as string[]);
        setAba("formulario");
        setBannerRascunhoCloud(true);
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save com debounce de 1.5s
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      localStorage.setItem(RASCUNHO_KEY, JSON.stringify({ dados, camposIA }));
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [dados, camposIA]);

  function carregarRascunho() {
    const raw = localStorage.getItem(RASCUNHO_KEY);
    if (!raw) return;
    try {
      const salvo = JSON.parse(raw) as { dados: DadosFormulario; camposIA: string[] };
      setDados(salvo.dados);
      setCamposIA(salvo.camposIA ?? []);
      setAba("formulario");
      setRascunhoDisponivel(false);
    } catch { /* ignore */ }
  }

  function descartarRascunho() {
    localStorage.removeItem(RASCUNHO_KEY);
    setRascunhoDisponivel(false);
  }

  async function compartilharRascunho() {
    setGerandoLink(true);
    setLinkRascunho(null);
    try {
      const res = await fetch("/api/rascunho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados, camposIA, modulo: "voo-internacional-1-autor" }),
      });
      if (!res.ok) throw new Error("Erro ao salvar rascunho");
      const { id } = await res.json() as { id: string };
      setLinkRascunho(`${window.location.origin}/voo-internacional-1-autor?rascunho=${id}`);
    } catch {
      // silencioso
    } finally {
      setGerandoLink(false);
    }
  }

  function copiarLink() {
    if (!linkRascunho) return;
    navigator.clipboard.writeText(linkRascunho).catch(() => {});
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  }

  function confirmarRevisaoExpressa() {
    setMoraisConfirmado(true);
    setExtracaoConcluida(null);
    setErrosValidacao([]);
    setAba("revisao");
  }

  function avancarParaRevisao() {
    const erros: string[] = [];
    const autores = dados.autores ?? [];

    autores.forEach((a, i) => {
      if (!a.qualificacao?.trim()) erros.push(`Qualificação do Autor ${i + 1} obrigatória`);
    });

    if (!dados.companhia?.trim()) erros.push("Companhia aérea obrigatória");
    const voo1 = dados.voos?.[0];
    if (!voo1?.numero?.trim()) erros.push("Número do voo obrigatório");
    if (!voo1?.data?.trim()) erros.push("Data do voo obrigatória");
    if (!dados.chegada_prevista?.trim()) erros.push("Chegada prevista obrigatória");
    if (!dados.chegada_real?.trim()) erros.push("Chegada real obrigatória");
    if (!dados.valor_morais || parseFloat(dados.valor_morais) <= 0) erros.push("Valor dos danos morais obrigatório");
    if (dados.valor_morais && parseFloat(dados.valor_morais) > 0 && !moraisConfirmado)
      erros.push("Confirme o valor dos danos morais clicando no botão amarelo");

    if (erros.length > 0) {
      setValidarCampos(true);
      setErrosValidacao(erros);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrosValidacao([]);
    setAba("revisao");
  }

  function normalizarCompanhia(nome: string | undefined): CompanhiaInternacionalKey | "" {
    if (!nome) return "";
    if (nome in COMPANIAS_INTERNACIONAL) return nome as CompanhiaInternacionalKey;
    const porNome = (Object.entries(COMPANIAS_INTERNACIONAL) as [CompanhiaInternacionalKey, { nome_fantasia: string }][])
      .find(([, c]) => c.nome_fantasia.toLowerCase() === nome.toLowerCase());
    if (porNome) return porNome[0];
    const v = nome.toLowerCase();
    if (v.includes("ita"))         return "ITA";
    if (v.includes("latam"))       return "LATAM";
    if (v.includes("gol"))         return "GOL";
    if (v.includes("azul"))        return "AZUL";
    if (v.includes("air france"))  return "AIR_FRANCE";
    if (v.includes("klm"))         return "KLM";
    if (v.includes("tap"))         return "TAP";
    if (v.includes("american"))    return "AMERICAN";
    if (v.includes("united"))      return "UNITED";
    if (v.includes("emirates"))    return "EMIRATES";
    if (v.includes("iberia"))      return "IBERIA";
    return "";
  }

  function handleExtraido(extraido: DadosExtraidos, campos: string[], novasConfiancas: ConfiancaExtracao = {}) {
    setConfiancas(novasConfiancas);
    const tipoRota = extraido.tipo_rota === "conexao" ? "conexao"
      : extraido.tipo_rota === "2conexoes" ? "2conexoes"
      : "direto";
    const perdaComp = extraido.compromisso_perdido ? "profissional" : "nao";

    let chegPrev = extraido.chegada_prevista ?? "";
    if (!chegPrev) {
      const voos = extraido.voos ?? [];
      const ultimoVoo = voos[voos.length - 1];
      if (ultimoVoo?.data && ultimoVoo?.chegada) {
        chegPrev = `${ultimoVoo.data} ${ultimoVoo.chegada}`;
      }
    }

    let chegReal = extraido.chegada_real ?? "";
    if (!chegReal) {
      const realoc = extraido.voo_realocacao;
      if (realoc?.data && realoc?.chegada) {
        chegReal = `${realoc.data} ${realoc.chegada}`;
      }
    }

    const atrasoMin = calcularAtrasoMinutos(chegPrev, chegReal);
    const valorSugerido = sugerirValorMorais(atrasoMin, perdaComp);
    const companhiaDetectada = normalizarCompanhia(extraido.companhia);

    const novosCampos = [...campos];
    if (valorSugerido) novosCampos.push("valor_morais");
    if (companhiaDetectada) novosCampos.push("companhia");

    setCamposIA(novosCampos);
    setDados((prev) => ({
      ...prev,
      companhia: companhiaDetectada || prev.companhia,
      tipo_rota: tipoRota as DadosFormulario["tipo_rota"],
      voos: extraido.voos?.length
        ? extraido.voos.map((v) => ({
            numero: v.numero ?? "",
            origem_cidade: v.origem_cidade ?? "",
            origem_sigla: v.origem_sigla ?? "",
            destino_cidade: v.destino_cidade ?? "",
            destino_sigla: v.destino_sigla ?? "",
            data: v.data ?? "",
            dia_semana: v.dia_semana ?? "",
            partida: v.partida ?? "",
            chegada: v.chegada ?? "",
          }))
        : prev.voos,
      voo_realocacao: extraido.voo_realocacao ?? prev.voo_realocacao,
      chegada_prevista: chegPrev || prev.chegada_prevista,
      chegada_real: chegReal || prev.chegada_real,
      gastos: extraido.gastos?.length ? extraido.gastos.map((g) => ({ ...g, descricao: "" })) : prev.gastos,
      tem_gastos: (extraido.gastos?.length ?? 0) > 0 || prev.tem_gastos,
      relato: extraido.relato || prev.relato,
      desc_compromisso: extraido.compromisso_perdido || prev.desc_compromisso,
      desc_compromisso_detalhe: extraido.compromisso_detalhe || prev.desc_compromisso_detalhe,
      perda_compromisso: perdaComp !== "nao" ? perdaComp : prev.perda_compromisso,
      valor_morais: valorSugerido || prev.valor_morais,
    }));

    const voo1 = extraido.voos?.[0];
    const vooLabel = voo1?.numero
      ? `${voo1.numero}${voo1.origem_sigla ? ` · ${voo1.origem_sigla}→${voo1.destino_sigla || "?"}` : ""}`
      : "Não identificado";
    const atrasoLabel = atrasoMin >= 60
      ? calcularAtraso(chegPrev, chegReal).texto
      : atrasoMin > 0 ? `${atrasoMin} min` : "—";

    setExtracaoConcluida({
      companhia: companhiaDetectada || extraido.companhia || "Não identificada",
      voo: vooLabel,
      atraso: atrasoLabel,
      valorSugerido: valorSugerido ? `R$ ${parseFloat(valorSugerido).toLocaleString("pt-BR")}` : "—",
    });
  }

  async function gerarPeca() {
    setGerando(true);
    setErro("");
    setEtapaGeracao("Reescrevendo relato em linguagem jurídica...");
    try {
      const res = await fetch("/api/gerar-peca-internacional-1-autor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados }),
      });

      setEtapaGeracao("Montando documento...");

      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? "Erro ao gerar peça");
      }

      const json = await res.json() as { docx: string; nomeArquivo: string; revisoes: RevisaoTextos };
      setModalRevisao({ docxBase64: json.docx, nomeArquivo: json.nomeArquivo, revisoes: json.revisoes });
      setEtapaGeracao("");
      await salvarHistorico(dados, tempoExtracaoMs);
      localStorage.removeItem(RASCUNHO_KEY);
      setRascunhoDisponivel(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
      setEtapaGeracao("");
    } finally {
      setGerando(false);
    }
  }

  const abaAtualIdx = STEPS.findIndex((s) => s.id === aba);
  const todosMarcados = checklist.every(Boolean);
  const stepAtual = STEPS[abaAtualIdx];
  const autoresComNome = dados.autores ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-300">

      {/* ── MODAL DE REVISÃO ── */}
      {modalRevisao && (
        <ModalRevisaoTextos
          docxBase64={modalRevisao.docxBase64}
          nomeArquivo={modalRevisao.nomeArquivo}
          revisoes={modalRevisao.revisoes}
          onClose={() => setModalRevisao(null)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className="w-64 bg-slate-900 fixed top-0 left-0 h-full flex flex-col z-20 shadow-xl">

        <div className="px-6 pt-7 pb-6 border-b border-slate-700">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs mb-4 transition-colors group"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            Voltar ao início
          </button>
          <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-1">LMC Advogados</p>
          <h1 className="text-white font-bold text-base leading-tight">Voo Internacional</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            1 Autor · Petição Inicial
          </p>
        </div>

        {/* Barra de progresso geral */}
        {(() => {
          const temQual = !!(dados.autores?.[0]?.qualificacao?.trim());
          const temCompanhia = !!(dados.companhia);
          const qualPct = ((temQual ? 0.5 : 0) + (temCompanhia ? 0.5 : 0)) * 25;

          let pct: number;
          if (aba === "revisao") {
            const feitos = checklist.filter(Boolean).length;
            const checkPct = checklist.length > 0 ? feitos / checklist.length : 0;
            pct = 75 + checkPct * 25;
          } else if (aba === "formulario") {
            pct = 50 + (moraisConfirmado ? 25 : 0);
          } else if (aba === "documentos") {
            pct = 25;
          } else {
            pct = qualPct;
          }
          const completo = pct >= 100;
          return (
            <div className="px-5 py-4 border-b border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-400 font-medium">Progresso</span>
                <span className={`text-xs font-bold tabular-nums ${completo ? "text-emerald-400" : "text-indigo-400"}`}>
                  {Math.round(pct)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700/80 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${completo ? "bg-emerald-500" : "bg-gradient-to-r from-indigo-600 to-indigo-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">
                {completo
                  ? "✓ Pronto para gerar a peça!"
                  : `Fase ${abaAtualIdx + 1} de ${STEPS.length} — ${stepAtual.label}`}
              </p>
            </div>
          );
        })()}

        <nav className="flex-1 px-4 py-6 space-y-1">
          {STEPS.map((step, idx) => {
            const concluido = idx < abaAtualIdx;
            const ativo = step.id === aba;
            return (
              <button
                key={step.id}
                onClick={() => setAba(step.id)}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                  ativo
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50"
                    : "text-slate-300 hover:bg-slate-800 cursor-pointer"
                }`}
              >
                <span className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  ativo ? "bg-white text-indigo-600 ring-2 ring-white/30"
                    : concluido ? "bg-emerald-500 text-white"
                    : "bg-slate-700 text-slate-400"
                }`}>
                  {concluido ? "✓" : step.num}
                </span>
                <span>
                  <span className="block text-sm font-semibold leading-tight">{step.label}</span>
                  <span className={`block text-xs mt-0.5 ${ativo ? "text-indigo-200" : "text-slate-500"}`}>
                    {step.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {rascunhoDisponivel && (
          <div className="mx-4 mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-amber-400 text-xs font-semibold mb-2">Rascunho salvo</p>
            <div className="flex gap-1.5">
              <button onClick={carregarRascunho} className="flex-1 py-1 bg-amber-500 text-white text-xs font-medium rounded hover:bg-amber-400 transition-colors">
                Continuar
              </button>
              <button onClick={descartarRascunho} className="flex-1 py-1 border border-amber-500/50 text-amber-400 text-xs font-medium rounded hover:bg-amber-500/10 transition-colors">
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* Compartilhar rascunho */}
        <div className="mx-4 mb-3">
          {!linkRascunho ? (
            <button
              onClick={compartilharRascunho}
              disabled={gerandoLink}
              className="w-full py-1.5 px-3 text-xs text-slate-400 hover:text-indigo-400 border border-slate-700 hover:border-indigo-600/50 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {gerandoLink ? (
                <>
                  <span className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  Gerando link...
                </>
              ) : (
                <>🔗 Compartilhar rascunho</>
              )}
            </button>
          ) : (
            <div className="p-2.5 bg-slate-800 rounded-lg space-y-2">
              <p className="text-[10px] text-slate-400 font-medium">Link válido por 7 dias:</p>
              <div className="flex gap-1">
                <input
                  readOnly
                  value={linkRascunho}
                  className="flex-1 text-[10px] bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-300 truncate min-w-0 cursor-pointer"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copiarLink}
                  className={`px-2 py-1 text-[10px] rounded shrink-0 transition-all font-semibold ${
                    linkCopiado
                      ? "bg-emerald-600 text-white"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  }`}
                >
                  {linkCopiado ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <button
                onClick={() => setLinkRascunho(null)}
                className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-slate-600 text-xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Salvo automaticamente
          </p>
          <ThemeToggle />
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen">

        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {stepAtual.num}. {stepAtual.label}
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">{stepAtual.desc}</p>
          </div>
          <div className="flex items-center gap-3">
            <QueueIndicator />
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s.id} className={`rounded-full transition-all duration-300 ${
                  i < abaAtualIdx ? "w-2 h-2 bg-emerald-500"
                    : i === abaAtualIdx ? "w-3 h-3 bg-indigo-600"
                    : "w-2 h-2 bg-slate-200"
                }`} />
              ))}
            </div>
          </div>
        </div>

        <main className="flex-1 px-8 py-7">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-7">

              {/* Banner: rascunho carregado via link compartilhável */}
              {bannerRascunhoCloud && (
                <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-700 rounded-xl">
                  <span className="text-lg shrink-0">🔗</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Rascunho compartilhado carregado</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Revise os dados abaixo e gere a peça quando estiver pronto.</p>
                  </div>
                  <button
                    onClick={() => setBannerRascunhoCloud(false)}
                    className="text-indigo-400 hover:text-indigo-600 text-xl leading-none shrink-0 transition-colors"
                    aria-label="Fechar banner"
                  >
                    ×
                  </button>
                </div>
              )}

              {aba === "qualificacao" && (
                <div>
                  <AbaQualificacaoInternacional
                    dados={dados}
                    onChange={setDados}
                    camposIA={camposIA}
                    validarCampos={validarCampos}
                    maxAutores={1}
                  />
                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
                      <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-[10px]">Enter</kbd>
                      para avançar
                    </span>
                    <button
                      onClick={() => setAba("documentos")}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      Avançar para Documentos →
                    </button>
                  </div>
                </div>
              )}

              {aba === "documentos" && (
                <div>
                  <AbaDocumentos
                    onExtraido={handleExtraido}
                    apiEndpoint="/api/extrair-dados-internacional"
                    onTempoExtracao={(ms) => setTempoExtracaoMs(ms)}
                  />
                  {extracaoConcluida && (
                    <RevisaoExpressa
                      dados={dados}
                      onChange={setDados}
                      camposIA={camposIA}
                      confiancas={confiancas}
                      onConfirmar={confirmarRevisaoExpressa}
                      onVerFormulario={() => { setExtracaoConcluida(null); setAba("formulario"); }}
                    />
                  )}
                </div>
              )}

              {aba === "formulario" && (
                <div>
                  <AbaFormulario
                    dados={dados}
                    onChange={setDados}
                    camposIA={camposIA}
                    confiancas={confiancas}
                    moraisConfirmado={moraisConfirmado}
                    onMoraisConfirmado={() => setMoraisConfirmado(true)}
                    validarCampos={validarCampos}
                  />

                  <PainelConsultaVoo dados={dados} onChange={setDados} />

                  {errosValidacao.length > 0 && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">⚠ Corrija antes de avançar:</p>
                      <ul className="space-y-1">
                        {errosValidacao.map((e, i) => (
                          <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <button onClick={() => setAba("documentos")} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                      ← Voltar aos documentos
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
                        <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-[10px]">Enter</kbd>
                        para avançar
                      </span>
                      <button onClick={avancarParaRevisao} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                        Avançar para Revisão →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {aba === "revisao" && (
                <div>
                  <AbaRevisao
                    dados={dados}
                    camposIA={camposIA}
                    onEditar={(secao) => { void secao; setAba("formulario"); }}
                    checklist={checklist}
                    onChecklist={(idx, val) => {
                      const novo = [...checklist];
                      novo[idx] = val;
                      setChecklist(novo);
                    }}
                  />

                  {etapaGeracao && (
                    <div className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border transition-all duration-300 ${
                      etapaGeracao.includes("sucesso")
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-indigo-50 border-indigo-200 text-indigo-700"
                    }`}>
                      {!etapaGeracao.includes("sucesso") && (
                        <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                      )}
                      {etapaGeracao.includes("sucesso") && (
                        <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs shrink-0">✓</span>
                      )}
                      {etapaGeracao}
                    </div>
                  )}

                  {erro && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                      {erro}
                    </div>
                  )}

                  {!todosMarcados && (
                    <p className="mt-4 text-sm text-amber-600 flex items-center gap-1.5">
                      <span className="w-4 h-4 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xs shrink-0">!</span>
                      Marque todos os itens do checklist para liberar a geração.
                    </p>
                  )}

                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-3 items-center justify-between">
                    <button onClick={() => setAba("formulario")} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                      ← Voltar ao formulário
                    </button>
                    <div className="flex flex-wrap gap-3 items-center">
                      <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
                        <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-[10px]">Ctrl</kbd>
                        +
                        <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-[10px]">G</kbd>
                        para gerar
                      </span>
                      <button
                        onClick={() => setMostrarPreview(true)}
                        className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                      >
                        👁 Pré-visualizar
                      </button>
                      <button
                        onClick={gerarPeca}
                        disabled={!todosMarcados || gerando}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-200 text-sm"
                      >
                        {gerando ? "Aguarde..." : "Gerar Peça .docx"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {aba === "documentos" && (
            <div className="mt-4 flex items-center justify-between px-1">
              <button onClick={() => setAba("qualificacao")} className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">
                ← Voltar à qualificação
              </button>
              <div className="flex items-center gap-3">
                <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
                  <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-[10px]">Enter</kbd>
                  para ir ao formulário
                </span>
                <button onClick={() => setAba("formulario")} className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">
                  Pular extração e preencher manualmente →
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── PREVIEW MODAL ── */}
      {mostrarPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setMostrarPreview(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Pré-visualização</h3>
                <p className="text-xs text-slate-400 mt-0.5">Resumo dos dados que serão inseridos na petição</p>
              </div>
              <button
                onClick={() => setMostrarPreview(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 text-sm">

              {/* Autor */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Autor
                </p>
                {(dados.autores ?? []).map((a, i) => (
                  a.nome ? (
                    <div key={i} className="mb-2">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {i + 1}. {a.nome}
                        {a.idoso && <span className="ml-2 text-xs text-amber-600 font-normal">idoso</span>}
                      </p>
                      {a.qualificacao && (
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 line-clamp-1">{a.qualificacao}</p>
                      )}
                    </div>
                  ) : null
                ))}
              </div>

              {/* Réu */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Réu</p>
                <p className="text-slate-800 dark:text-slate-100">{dados.companhia || "—"}</p>
              </div>

              {/* Voos */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Voos ({dados.tipo_rota === "direto" ? "Direto" : dados.tipo_rota === "conexao" ? "1 conexão" : "2 conexões"})
                </p>
                {(dados.voos ?? []).slice(0, dados.tipo_rota === "direto" ? 1 : dados.tipo_rota === "conexao" ? 2 : 3).map((v, i) => (
                  <div key={i} className="mb-1.5 text-slate-700 dark:text-slate-300">
                    <span className="text-xs text-slate-400 mr-1">Voo {i + 1}:</span>
                    {v.numero || "—"} · {v.origem_cidade || "?"}/{v.origem_sigla || "?"} → {v.destino_cidade || "?"}/{v.destino_sigla || "?"} · {v.data || "?"} {v.partida || "?"}→{v.chegada || "?"}
                  </div>
                ))}
              </div>

              {/* Atraso */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Atraso</p>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <span><span className="text-slate-400 text-xs">Prevista: </span>{dados.chegada_prevista || "—"}</span>
                  <span><span className="text-slate-400 text-xs">Real: </span>{dados.chegada_real || "—"}</span>
                </div>
                {dados.tempo_atraso && (
                  <p className="mt-1 text-indigo-600 dark:text-indigo-400 font-semibold">{dados.tempo_atraso}</p>
                )}
              </div>

              {/* Valores */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Valores</p>
                <p className="text-slate-800 dark:text-slate-100 font-semibold">
                  Danos morais: R$ {dados.valor_morais || "—"}
                </p>
                {dados.valor_morais_extenso && (
                  <p className="text-slate-500 dark:text-slate-400 text-xs">{dados.valor_morais_extenso}</p>
                )}
              </div>

              {dados.relato && (
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Relato</p>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-6 text-xs leading-relaxed">{dados.relato}</p>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center pt-1">
                Pressione <kbd className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">Esc</kbd> ou clique fora para fechar
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
