import type { AgentEvent } from '@agentscope-ai/agentscope/event';

import { getAccessToken, getApiBase, refreshAccessToken } from '@/api/client';
import { streamPath } from '@/api/messages';
import { recordMetric } from '@/lib/metrics';

import { createSseDecoder, parseAgentEvent } from './parser';

export type ConnectionPhase = 'connecting' | 'open' | 'reconnecting' | 'error' | 'closed';

export interface ReconnectState {
  attempt: number;
  message: string;
}

export interface StreamControllerOptions {
  sessionId: string;
  onEvent: (event: AgentEvent) => void;
  onPhaseChange: (phase: ConnectionPhase, state: ReconnectState) => void;
  resync: () => Promise<string | null>;
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 30000];
const MAX_ATTEMPTS = BACKOFF_MS.length;
const IDLE_TIMEOUT_MS = 45_000;

export class StreamController {
  private readonly options: StreamControllerOptions;
  private abortController: AbortController | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private stopped = true;
  private startedAt = 0;
  private firstEventSeen = false;

  constructor(options: StreamControllerOptions) {
    this.options = options;
  }

  start(after: string | null): void {
    this.stopped = false;
    this.attempt = 0;
    this.startedAt = performance.now();
    this.firstEventSeen = false;
    void this.connect(after, false);
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.abortController?.abort();
    this.abortController = null;
    this.options.onPhaseChange('closed', { attempt: 0, message: '' });
  }

  async reconnectNow(): Promise<void> {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    this.attempt = 0;
    await this.connect(await this.safeResync(), false);
  }

  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private async safeResync(): Promise<string | null> {
    try {
      return await this.options.resync();
    } catch {
      return null;
    }
  }

  private armIdleWatchdog(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.abortController?.abort();
    }, IDLE_TIMEOUT_MS);
  }

  private async connect(after: string | null, retriedAuth: boolean): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;

    const token = getAccessToken();
    const url = `${getApiBase()}${streamPath(this.options.sessionId, after)}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.status === 401 && !retriedAuth) {
        await refreshAccessToken();
        await this.connect(after, true);
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error(`事件流连接失败（${response.status}）`);
      }

      this.attempt = 0;
      this.options.onPhaseChange('open', { attempt: 0, message: '' });
      this.armIdleWatchdog();

      const reader = response.body.getReader();
      const decoder = createSseDecoder((data) => {
        const event = parseAgentEvent(data);
        if (!event) {
          return;
        }
        if (!this.firstEventSeen) {
          this.firstEventSeen = true;
          recordMetric('sse_first_event_ms', Math.round(performance.now() - this.startedAt));
        }
        this.options.onEvent(event);
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        this.armIdleWatchdog();
        decoder.push(value);
      }
      decoder.flush();

      if (!this.stopped) {
        this.scheduleReconnect('事件流已中断', false);
      }
    } catch (error) {
      if (this.stopped || controller.signal.aborted) {
        if (!this.stopped) {
          this.scheduleReconnect('连接超时', false);
        }
        return;
      }
      const message = error instanceof Error ? error.message : '事件流连接失败';
      this.scheduleReconnect(message, false);
    }
  }

  private scheduleReconnect(message: string, _immediate: boolean): void {
    if (this.stopped) {
      return;
    }
    this.clearTimers();
    this.attempt += 1;

    if (this.attempt > MAX_ATTEMPTS) {
      recordMetric('sse_reconnect_exhausted', 1);
      this.options.onPhaseChange('error', { attempt: this.attempt - 1, message });
      return;
    }

    const delay = BACKOFF_MS[this.attempt - 1] ?? 30_000;
    recordMetric('sse_reconnect_total', 1, { attempt: this.attempt });
    this.options.onPhaseChange('reconnecting', { attempt: this.attempt, message });

    this.retryTimer = setTimeout(() => {
      void (async () => {
        if (this.stopped) {
          return;
        }
        const cursor = await this.safeResync();
        await this.connect(cursor, false);
      })();
    }, delay);
  }
}
