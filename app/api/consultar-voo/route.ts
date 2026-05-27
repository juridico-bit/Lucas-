export const runtime = "nodejs";

/**
 * API de consulta de dados reais de voo via AviationStack.
 *
 * POST /api/consultar-voo
 * Body: { numero: string; data: string }   // data no formato DD/MM/AAAA
 *
 * Retorna:
 * {
 *   configurado: boolean,   // false quando AVIATIONSTACK_API_KEY não está definida
 *   encontrado: boolean,
 *   voo: DadosVooAPI | null,
 *   mensagem?: string,
 * }
 *
 * Variável de ambiente necessária: AVIATIONSTACK_API_KEY
 * (cadastre em https://aviationstack.com/ — plano gratuito: 500 req/mês)
 */

import { NextRequest, NextResponse } from "next/server";

export interface DadosVooAPI {
  numero: string;
  origem: { cidade: string; sigla: string };
  destino: { cidade: string; sigla: string };
  partida_prevista: string;   // "DD/MM/AAAA HH:MM"
  partida_real: string;       // "" se não disponível
  chegada_prevista: string;   // "DD/MM/AAAA HH:MM"
  chegada_real: string;       // "" se não disponível
  atraso_minutos: number;     // 0 se não disponível
  status: string;             // "landed", "cancelled", etc.
  fonte: string;              // "AviationStack"
}

/** Converte "DD/MM/AAAA" → "AAAA-MM-DD" */
function brParaIso(data: string): string {
  const [d, m, y] = data.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Converte ISO datetime UTC → "DD/MM/AAAA HH:MM" no fuso de Brasília */
function isoParaBR(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // Retorna algo como "27/05/2025, 14:30" → normalizar
    return fmt.format(d).replace(",", "").replace(/\s+/, " ");
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.AVIATIONSTACK_API_KEY ?? "";

  // Se a chave não estiver configurada, retorna graciosamente
  if (!apiKey.trim()) {
    return NextResponse.json({
      configurado: false,
      encontrado: false,
      voo: null,
      mensagem: "Integração com AviationStack não configurada (AVIATIONSTACK_API_KEY ausente).",
    });
  }

  let body: { numero?: string; data?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const numero = (body.numero ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const dataIso = brParaIso(body.data ?? "");

  if (!numero || !dataIso) {
    return NextResponse.json(
      { error: "Campos obrigatórios: numero e data (DD/MM/AAAA)" },
      { status: 400 }
    );
  }

  // Monta URL da API AviationStack
  // Nota: plano gratuito só aceita HTTP (não HTTPS) — chamada é server-side, portanto segura
  const url = new URL("http://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("flight_iata", numero);
  url.searchParams.set("flight_date", dataIso);
  url.searchParams.set("limit", "1");

  try {
    const resp = await fetch(url.toString(), {
      headers: { "User-Agent": "peticoes-sistema/1.0" },
      // Timeout de 8 s para não travar o formulário
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error("[consultar-voo] AviationStack HTTP error:", resp.status, txt);
      return NextResponse.json({
        configurado: true,
        encontrado: false,
        voo: null,
        mensagem: `Erro na consulta à AviationStack (HTTP ${resp.status}).`,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await resp.json();

    if (json.error) {
      console.error("[consultar-voo] AviationStack API error:", json.error);
      return NextResponse.json({
        configurado: true,
        encontrado: false,
        voo: null,
        mensagem: json.error?.info ?? "Erro na API AviationStack.",
      });
    }

    const resultados: unknown[] = json.data ?? [];
    if (resultados.length === 0) {
      return NextResponse.json({
        configurado: true,
        encontrado: false,
        voo: null,
        mensagem: `Voo ${numero} em ${body.data} não encontrado na base AviationStack.`,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v: any = resultados[0];

    // Extrai horários (podem vir como null na API quando ainda não disponíveis)
    const partidaPrevista = isoParaBR(v.departure?.scheduled);
    const partidaReal     = isoParaBR(v.departure?.actual ?? v.departure?.estimated);
    const chegadaPrevista = isoParaBR(v.arrival?.scheduled);
    const chegadaReal     = isoParaBR(v.arrival?.actual ?? v.arrival?.estimated);

    // Atraso em minutos (API fornece em segundos em alguns campos, ou como delay em minutos)
    const atrasoMinutos: number =
      v.arrival?.delay ?? v.departure?.delay ?? 0;

    const dadosVoo: DadosVooAPI = {
      numero:           v.flight?.iata ?? numero,
      origem: {
        cidade: v.departure?.airport ?? "",
        sigla:  v.departure?.iata    ?? "",
      },
      destino: {
        cidade: v.arrival?.airport ?? "",
        sigla:  v.arrival?.iata    ?? "",
      },
      partida_prevista: partidaPrevista,
      partida_real:     partidaReal,
      chegada_prevista: chegadaPrevista,
      chegada_real:     chegadaReal,
      atraso_minutos:   typeof atrasoMinutos === "number" ? atrasoMinutos : 0,
      status:           v.flight_status ?? "",
      fonte:            "AviationStack",
    };

    return NextResponse.json({
      configurado: true,
      encontrado: true,
      voo: dadosVoo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[consultar-voo] fetch error:", msg);
    return NextResponse.json({
      configurado: true,
      encontrado: false,
      voo: null,
      mensagem: `Falha na requisição: ${msg}`,
    });
  }
}
