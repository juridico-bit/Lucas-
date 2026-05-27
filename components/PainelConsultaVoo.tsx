"use client";

/**
 * PainelConsultaVoo — exibe e aplica dados reais de voo via AviationStack.
 *
 * Só aparece quando:
 *   - O primeiro voo tem número E data preenchidos, E
 *   - Pelo menos um campo relevante está faltando:
 *     chegada_prevista, chegada_real, origem_cidade/sigla, destino_cidade/sigla
 *
 * Não bloqueia o formulário. É um painel auxiliar, totalmente opcional.
 */

import { useState, useEffect, useRef } from "react";
import { DadosFormulario } from "@/lib/types";

interface DadosVooAPI {
  numero: string;
  origem: { cidade: string; sigla: string };
  destino: { cidade: string; sigla: string };
  partida_prevista: string;
  partida_real: string;
  chegada_prevista: string;
  chegada_real: string;
  atraso_minutos: number;
  status: string;
  fonte: string;
}

interface RespostaAPI {
  configurado: boolean;
  encontrado: boolean;
  voo: DadosVooAPI | null;
  mensagem?: string;
}

interface Props {
  dados: DadosFormulario;
  onChange: (d: DadosFormulario) => void;
}

/** Formatação legível do status da AviationStack */
function formatarStatus(status: string): string {
  const mapa: Record<string, string> = {
    scheduled: "Programado",
    active:    "Em voo",
    landed:    "Pousou",
    cancelled: "Cancelado",
    incident:  "Incidente",
    diverted:  "Desviado",
  };
  return mapa[status] ?? status;
}

/** Extraiu apenas HH:MM de "DD/MM/AAAA HH:MM" */
function somenteHora(dt: string): string {
  if (!dt) return "";
  const partes = dt.trim().split(" ");
  return partes.length >= 2 ? partes[partes.length - 1] : dt;
}

export default function PainelConsultaVoo({ dados, onChange }: Props) {
  const [resultado, setResultado] = useState<RespostaAPI | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [aplicado, setAplicado] = useState(false);
  const [erroConsulta, setErroConsulta] = useState("");

  // Número + data do primeiro voo
  const voo0 = dados.voos?.[0];
  const numero = (voo0?.numero ?? "").trim();
  const dataVoo = (voo0?.data ?? "").trim();

  // Campos que ainda estão faltando no formulário
  const faltaChegadaPrevista = !dados.chegada_prevista?.trim();
  const faltaChegadaReal     = !dados.chegada_real?.trim();
  const faltaOrigem  = !voo0?.origem_cidade?.trim() || !voo0?.origem_sigla?.trim();
  const faltaDestino = !voo0?.destino_cidade?.trim() || !voo0?.destino_sigla?.trim();
  const temInfoIncompleta = faltaChegadaPrevista || faltaChegadaReal || faltaOrigem || faltaDestino;

  // Referências para detectar mudança de voo/data e limpar resultado anterior
  const prevRef = useRef({ numero: "", dataVoo: "" });
  useEffect(() => {
    if (
      prevRef.current.numero !== numero ||
      prevRef.current.dataVoo !== dataVoo
    ) {
      setResultado(null);
      setAplicado(false);
      setErroConsulta("");
    }
    prevRef.current = { numero, dataVoo };
  }, [numero, dataVoo]);

  // Só mostra quando tem número + data E há campos faltando
  const deveExibir = numero.length >= 4 && dataVoo.length === 10 && temInfoIncompleta;
  if (!deveExibir) return null;

  async function consultar() {
    setConsultando(true);
    setErroConsulta("");
    setResultado(null);
    setAplicado(false);
    try {
      const resp = await fetch("/api/consultar-voo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero, data: dataVoo }),
      });
      const json: RespostaAPI = await resp.json();
      setResultado(json);
      if (!json.configurado) {
        setErroConsulta("Integração não configurada. Adicione AVIATIONSTACK_API_KEY ao .env.local.");
      } else if (!json.encontrado) {
        setErroConsulta(json.mensagem ?? "Voo não encontrado na base AviationStack.");
      }
    } catch {
      setErroConsulta("Falha na requisição à API de voos.");
    } finally {
      setConsultando(false);
    }
  }

  function aplicarCamposVazios() {
    if (!resultado?.voo) return;
    const v = resultado.voo;
    const novosDados: DadosFormulario = { ...dados };
    const novosVoos = [...(novosDados.voos ?? [])];
    const vooAtualizado = { ...novosVoos[0] };

    // Preenche apenas campos vazios — nunca sobrescreve o que o cliente já forneceu
    if (faltaOrigem) {
      if (!vooAtualizado.origem_cidade?.trim()) vooAtualizado.origem_cidade = v.origem.cidade;
      if (!vooAtualizado.origem_sigla?.trim())  vooAtualizado.origem_sigla  = v.origem.sigla;
    }
    if (faltaDestino) {
      if (!vooAtualizado.destino_cidade?.trim()) vooAtualizado.destino_cidade = v.destino.cidade;
      if (!vooAtualizado.destino_sigla?.trim())  vooAtualizado.destino_sigla  = v.destino.sigla;
    }
    // Horário de partida (só HH:MM — o campo armazena só hora)
    if (!vooAtualizado.partida?.trim() && v.partida_prevista) {
      vooAtualizado.partida = somenteHora(v.partida_prevista);
    }
    if (!vooAtualizado.chegada?.trim() && v.chegada_prevista) {
      vooAtualizado.chegada = somenteHora(v.chegada_prevista);
    }

    novosVoos[0] = vooAtualizado;
    novosDados.voos = novosVoos;

    // chegada_prevista e chegada_real ficam com data completa
    if (faltaChegadaPrevista && v.chegada_prevista) {
      novosDados.chegada_prevista = v.chegada_prevista;
    }
    if (faltaChegadaReal && v.chegada_real) {
      novosDados.chegada_real = v.chegada_real;
    }

    onChange(novosDados);
    setAplicado(true);
  }

  const vooApi = resultado?.voo;

  return (
    <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <span className="text-base">✈️</span>
          <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Consulta automática de voo
          </span>
          <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
            {numero} · {dataVoo}
          </span>
        </div>
        <button
          onClick={consultar}
          disabled={consultando}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
        >
          {consultando ? "Consultando…" : resultado ? "🔄 Reconsultar" : "🔍 Buscar dados"}
        </button>
      </div>

      {/* Corpo */}
      <div className="px-4 py-3">
        {/* Estado inicial (antes de consultar) */}
        {!resultado && !consultando && !erroConsulta && (
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Campos faltando:{" "}
            {[
              faltaOrigem && "origem",
              faltaDestino && "destino",
              faltaChegadaPrevista && "chegada prevista",
              faltaChegadaReal && "chegada real",
            ]
              .filter(Boolean)
              .join(", ")}
            . Clique em <strong>Buscar dados</strong> para preencher automaticamente.
          </p>
        )}

        {/* Consultando */}
        {consultando && (
          <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Consultando AviationStack…
          </div>
        )}

        {/* Erro */}
        {erroConsulta && !consultando && (
          <p className="text-xs text-red-600 dark:text-red-400">⚠ {erroConsulta}</p>
        )}

        {/* Resultado encontrado */}
        {!consultando && resultado?.encontrado && vooApi && (
          <div>
            {/* Grade de dados */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              <Campo label="Origem" valor={`${vooApi.origem.cidade} (${vooApi.origem.sigla})`} destaque={faltaOrigem} />
              <Campo label="Destino" valor={`${vooApi.destino.cidade} (${vooApi.destino.sigla})`} destaque={faltaDestino} />
              <Campo label="Status" valor={formatarStatus(vooApi.status)} />
              <Campo label="Partida prevista" valor={vooApi.partida_prevista} />
              <Campo label="Partida real" valor={vooApi.partida_real || "—"} />
              <Campo label="Chegada prevista" valor={vooApi.chegada_prevista} destaque={faltaChegadaPrevista} />
              <Campo label="Chegada real" valor={vooApi.chegada_real || "—"} destaque={faltaChegadaReal} />
              {vooApi.atraso_minutos > 0 && (
                <Campo label="Atraso registrado" valor={`${vooApi.atraso_minutos} min`} destaque />
              )}
            </div>

            {/* Fonte */}
            <p className="text-xs text-blue-500 dark:text-blue-500 mb-3">
              Fonte: {vooApi.fonte}
            </p>

            {/* Botão aplicar / confirmação */}
            {!aplicado ? (
              <button
                onClick={aplicarCamposVazios}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
              >
                ✅ Aplicar campos vazios
              </button>
            ) : (
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                ✅ Campos aplicados com sucesso! Confira o formulário abaixo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Sub-componente de célula de dado */
function Campo({
  label,
  valor,
  destaque = false,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 text-xs ${destaque ? "bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700" : "bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700"}`}>
      <p className="text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
      <p className={`font-semibold ${destaque ? "text-yellow-800 dark:text-yellow-300" : "text-slate-800 dark:text-slate-200"}`}>
        {valor || "—"}
      </p>
    </div>
  );
}
