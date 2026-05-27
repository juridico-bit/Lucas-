/**
 * GET /api/queue-status
 * Retorna as métricas em tempo real da fila de IA.
 * Usado pelo QueueIndicator no frontend para exibir status de processamento.
 */
import { NextResponse } from "next/server";
import { getQueueStats } from "@/lib/ai-queue";

export const runtime = "nodejs";

// Sem cache — dados em tempo real
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getQueueStats());
}
