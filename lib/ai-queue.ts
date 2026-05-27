/**
 * lib/ai-queue.ts
 *
 * Fila de processamento de IA — singleton compartilhado em todo o processo Node.js.
 *
 * Motivação: ao escalar para 10+ advogados simultâneos, as chamadas ao Claude
 * podem se acumular e disparar rate-limit (429) ou timeouts. Esta fila:
 *   - Limita a N chamadas simultâneas (padrão: 3, configurável via AI_QUEUE_CONCURRENCY)
 *   - Faz retry automático com backoff exponencial (padrão: 2 tentativas)
 *   - Expõe métricas em tempo real via getQueueStats()
 *
 * Não requer Redis nem dependências externas — ideal para implantações em servidor único.
 * Para escala horizontal (múltiplos processos/máquinas), substituir por BullMQ + Redis.
 */

type Task<T> = () => Promise<T>;

interface QueueItem {
  task: () => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  addedAt: number;
  label: string; // para logs
}

export interface QueueStats {
  running: number;   // chamadas em andamento agora
  waiting: number;   // na fila, aguardando slot
  concurrency: number;
  totalProcessed: number;
  totalErrors: number;
  totalRetries: number;
}

class AIQueue {
  private _running = 0;
  private _paused = false;
  private readonly _concurrency: number;
  private readonly _maxRetries: number;
  private _queue: QueueItem[] = [];

  // Contadores de ciclo de vida
  private _totalProcessed = 0;
  private _totalErrors = 0;
  private _totalRetries = 0;

  constructor(concurrency = 3, maxRetries = 2) {
    this._concurrency = concurrency;
    this._maxRetries = maxRetries;
  }

  // ── Adiciona tarefa e retorna Promise com o resultado ─────────────────────

  add<T>(task: Task<T>, label = "tarefa"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this._queue.push({
        task: () => this._runWithRetry(task, this._maxRetries, label),
        resolve: resolve as (v: unknown) => void,
        reject,
        addedAt: Date.now(),
        label,
      });
      this._tick();
    });
  }

  // ── Retry com backoff exponencial ────────────────────────────────────────

  private async _runWithRetry<T>(
    task: Task<T>,
    retriesLeft: number,
    label: string,
  ): Promise<T> {
    try {
      const result = await task();
      this._totalProcessed++;
      return result;
    } catch (err) {
      if (retriesLeft > 0) {
        this._totalRetries++;
        const attempt = this._maxRetries - retriesLeft + 1;
        const delay = 1_000 * Math.pow(2, attempt - 1); // 1 s, 2 s, 4 s…
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[AI Queue] "${label}" falhou (tentativa ${attempt}/${this._maxRetries}). ` +
          `Reprocessando em ${delay}ms… Erro: ${msg}`,
        );
        await _sleep(delay);
        return this._runWithRetry(task, retriesLeft - 1, label);
      }
      this._totalErrors++;
      throw err;
    }
  }

  // ── Despacha próximas tarefas dentro do limite de concorrência ───────────

  private _tick() {
    if (this._paused) return;
    while (this._running < this._concurrency && this._queue.length > 0) {
      const item = this._queue.shift()!;
      this._running++;
      item
        .task()
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this._running--;
          this._tick();
        });
    }
  }

  // ── Pausa / retoma ────────────────────────────────────────────────────────

  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
    this._tick();
  }

  // ── Métricas ──────────────────────────────────────────────────────────────

  get stats(): QueueStats {
    return {
      running: this._running,
      waiting: this._queue.length,
      concurrency: this._concurrency,
      totalProcessed: this._totalProcessed,
      totalErrors: this._totalErrors,
      totalRetries: this._totalRetries,
    };
  }
}

function _sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// Usa globalThis para sobreviver ao hot-reload em desenvolvimento (Next.js).
// Em produção (next start) o módulo só é carregado uma vez.

const _g = globalThis as typeof globalThis & { __aiQueue?: AIQueue };
if (!_g.__aiQueue) {
  const concurrency = parseInt(process.env.AI_QUEUE_CONCURRENCY ?? "3", 10);
  const retries     = parseInt(process.env.AI_QUEUE_RETRIES     ?? "2", 10);
  _g.__aiQueue = new AIQueue(
    Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 3,
    Number.isFinite(retries)     && retries >= 0     ? retries     : 2,
  );
  console.info(
    `[AI Queue] Iniciado — concorrência: ${_g.__aiQueue.stats.concurrency}, ` +
    `retries: ${retries}`,
  );
}

export const aiQueue = _g.__aiQueue;

// ── Helper principal ──────────────────────────────────────────────────────────

/**
 * Enfileira uma chamada de IA e aguarda o resultado.
 *
 * @param fn      Função que executa a chamada (ex: () => client.messages.create(...))
 * @param label   Rótulo para logs de retry (ex: "extrair-dados")
 */
export function enqueueAI<T>(fn: () => Promise<T>, label = "ai-call"): Promise<T> {
  return aiQueue.add(fn, label);
}

export function getQueueStats(): QueueStats {
  return aiQueue.stats;
}
