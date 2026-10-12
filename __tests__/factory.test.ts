import { describe, expect, it, jest } from 'bun:test'
import { FactoryApiError, FactoryClient, resolveCwd } from '../src/factory.js'

type Fetch = typeof fetch

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function client(fetchImpl: Fetch) {
  return new FactoryClient({
    apiKey: 'fk-test',
    baseUrl: 'https://api.test',
    fetch: fetchImpl,
    retryDelayMs: 0
  })
}

describe('FactoryClient', () => {
  it('creates a session with bearer auth', async () => {
    const fetchMock = jest
      .fn<Fetch>()
      .mockResolvedValue(json(201, { sessionId: 's1', status: 'idle' }))
    const s = await client(fetchMock).createSession({ computerId: 'c1' })
    expect(s.sessionId).toBe('s1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/api/v0/sessions')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer fk-test'
    )
    expect(JSON.parse(init?.body as string)).toEqual({ computerId: 'c1' })
  })

  it('retries createSession only on 429', async () => {
    const fetchMock = jest
      .fn<Fetch>()
      .mockResolvedValueOnce(
        json(429, {
          status: 429,
          title: 'Too Many Requests',
          detail: 'slow down'
        })
      )
      .mockResolvedValueOnce(json(201, { sessionId: 's1', status: 'idle' }))
    await expect(
      client(fetchMock).createSession({ computerId: 'c1' })
    ).resolves.toMatchObject({ sessionId: 's1' })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const failing = jest
      .fn<Fetch>()
      .mockResolvedValue(
        json(500, { status: 500, title: 'Error', detail: 'boom' })
      )
    await expect(
      client(failing).createSession({ computerId: 'c1' })
    ).rejects.toThrow(FactoryApiError)
    expect(failing).toHaveBeenCalledTimes(1)
  })

  it('returns undefined for a missing session', async () => {
    const fetchMock = jest
      .fn<Fetch>()
      .mockResolvedValue(
        json(404, { status: 404, title: 'Not Found', detail: 'x' })
      )
    await expect(client(fetchMock).getSession('gone')).resolves.toBeUndefined()
  })

  it('treats a message timeout as accepted', async () => {
    const fetchMock = jest
      .fn<Fetch>()
      .mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    await expect(
      client(fetchMock).postMessage('s1', 'hi', 10)
    ).resolves.toEqual({ timedOut: true })
  })

  it('retries a message once on 503', async () => {
    const fetchMock = jest
      .fn<Fetch>()
      .mockResolvedValueOnce(
        json(503, { status: 503, title: 'Unavailable', detail: 'x' })
      )
      .mockResolvedValueOnce(json(200, { messageId: 'm1', status: 'running' }))
    await expect(
      client(fetchMock).postMessage('s1', 'hi', 1000)
    ).resolves.toEqual({
      messageId: 'm1',
      status: 'running',
      timedOut: false
    })
  })

  it('surfaces API errors', async () => {
    const fetchMock = jest
      .fn<Fetch>()
      .mockResolvedValue(
        json(401, { status: 401, title: 'Unauthorized', detail: 'bad key' })
      )
    await expect(client(fetchMock).getComputer('c1')).rejects.toThrow(
      'Factory API 401 Unauthorized: bad key'
    )
  })
})

describe('resolveCwd', () => {
  it('picks the single matching clone', () => {
    const computer = {
      id: 'c',
      name: 'c',
      clonedRepoDirectories: [
        '/home/u/projects/widgets/',
        '/home/u/projects/other'
      ]
    }
    expect(resolveCwd(computer, 'widgets')).toBe('/home/u/projects/widgets/')
  })

  it('returns undefined when ambiguous or missing', () => {
    expect(
      resolveCwd(
        {
          id: 'c',
          name: 'c',
          clonedRepoDirectories: ['/a/widgets', '/b/widgets']
        },
        'widgets'
      )
    ).toBeUndefined()
    expect(resolveCwd({ id: 'c', name: 'c' }, 'widgets')).toBeUndefined()
  })
})
