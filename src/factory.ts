/**
 * Minimal client for the Factory API (https://docs.factory.com/api-reference).
 * Only the endpoints the action needs are implemented.
 */

export type SessionStatus = 'idle' | 'pending' | 'running'

export interface Session {
  sessionId: string
  status: SessionStatus
  computerId?: string
}

export interface Computer {
  id: string
  name: string
  status?: 'provisioning' | 'active' | 'error'
  clonedRepoDirectories?: string[]
}

export interface SessionSettings {
  model?: string
  reasoningEffort?: string
  interactionMode?: 'auto' | 'spec' | 'agi' | 'mission'
  autonomyLevel?: 'off' | 'low' | 'medium' | 'high'
  tags?: { name: string; metadata?: Record<string, string> }[]
  systemPrompt?: string | { type: 'preset'; preset: 'droid'; append: string }
}

export interface CreateSessionRequest {
  computerId: string
  cwd?: string
  sessionSettings?: SessionSettings
}

export interface PostMessageResult {
  messageId?: string
  status?: SessionStatus
  /** True when the request was sent but no response arrived before the timeout. */
  timedOut: boolean
}

export class FactoryApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string
  ) {
    super(`Factory API ${status} ${title}: ${detail}`)
    this.name = 'FactoryApiError'
  }
}

export interface FactoryClientOptions {
  apiKey: string
  baseUrl: string
  fetch?: typeof fetch
  /** Base delay for retries, in ms. */
  retryDelayMs?: number
}

export class FactoryClient {
  private readonly fetch: typeof fetch
  private readonly retryDelayMs: number

  constructor(private readonly opts: FactoryClientOptions) {
    this.fetch = opts.fetch ?? globalThis.fetch
    this.retryDelayMs = opts.retryDelayMs ?? 2000
  }

  /**
   * There is no idempotency key, so only 429 is retried: the request was
   * rejected before a session was created.
   */
  async createSession(body: CreateSessionRequest): Promise<Session> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.request<Session>('POST', '/api/v0/sessions', body)
      } catch (err) {
        if (
          err instanceof FactoryApiError &&
          err.status === 429 &&
          attempt < 3
        ) {
          await sleep(this.retryDelayMs * 2 ** attempt)
          continue
        }
        throw err
      }
    }
  }

  /** Returns undefined when the session does not exist (or was deleted). */
  async getSession(sessionId: string): Promise<Session | undefined> {
    try {
      return await this.request<Session>(
        'GET',
        `/api/v0/sessions/${encodeURIComponent(sessionId)}`
      )
    } catch (err) {
      if (err instanceof FactoryApiError && err.status === 404) return undefined
      throw err
    }
  }

  async interrupt(sessionId: string): Promise<void> {
    await this.request(
      'POST',
      `/api/v0/sessions/${encodeURIComponent(sessionId)}/interrupt`
    )
  }

  /**
   * Sends a message and returns as soon as it is accepted. The endpoint
   * "optionally waits for agent completion", so the request is bounded by a
   * timeout, and a timeout or a 504 is treated as accepted (fire-and-forget).
   * In practice it returns `pending` within seconds. 500/502/503 are retried
   * once.
   */
  async postMessage(
    sessionId: string,
    text: string,
    timeoutMs: number
  ): Promise<PostMessageResult> {
    const path = `/api/v0/sessions/${encodeURIComponent(sessionId)}/messages`
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await this.request<{
          messageId: string
          status: SessionStatus
        }>('POST', path, { text }, AbortSignal.timeout(timeoutMs))
        return { ...res, timedOut: false }
      } catch (err) {
        if (isTimeout(err)) return { timedOut: true }
        if (err instanceof FactoryApiError) {
          if (err.status === 504) return { timedOut: true }
          if ([500, 502, 503].includes(err.status) && attempt < 1) {
            await sleep(this.retryDelayMs)
            continue
          }
        }
        throw err
      }
    }
  }

  async getComputer(computerId: string): Promise<Computer> {
    return this.request<Computer>(
      'GET',
      `/api/v0/computers/${encodeURIComponent(computerId)}`
    )
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const res = await this.fetch(`${this.opts.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal
    })
    const raw = await res.text()
    if (!res.ok) {
      let title = res.statusText
      let detail = raw.slice(0, 500)
      try {
        const e = JSON.parse(raw) as { title?: string; detail?: string }
        title = e.title ?? title
        detail = e.detail ?? detail
      } catch {
        // Not a FactoryApiError body.
      }
      throw new FactoryApiError(res.status, title, detail)
    }
    return (raw ? JSON.parse(raw) : undefined) as T
  }
}

/**
 * Picks the clone of `repo` among the computer's cloned directories by the
 * last path segment. Returns undefined unless exactly one matches.
 */
export function resolveCwd(
  computer: Computer,
  repo: string
): string | undefined {
  const matches = (computer.clonedRepoDirectories ?? []).filter(
    (dir) =>
      dir.replace(/\/+$/, '').split('/').pop()?.toLowerCase() ===
      repo.toLowerCase()
  )
  return matches.length === 1 ? matches[0] : undefined
}

/**
 * Link to the session in the Factory web app.
 */
export function sessionUrl(sessionId: string): string {
  return `https://app.factory.ai/sessions/${encodeURIComponent(sessionId)}`
}

function isTimeout(err: unknown): boolean {
  // DOMException is not always an `instanceof Error` across realms.
  const name = (err as { name?: unknown } | null)?.name
  return name === 'TimeoutError' || name === 'AbortError'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
