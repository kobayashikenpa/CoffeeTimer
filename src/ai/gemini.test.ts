import { describe, expect, it } from 'vitest'
import { GEMINI_API_BASE, GEMINI_MODEL } from './model'
import { readRecipe } from './gemini'
import type { FetchLike } from './gemini'

// テスト用の仮のキー（本物のキーではない）
const KEY = 'test-key-not-real-000'
const VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

const recipeJson = {
  found: true,
  name: '4:6メソッド',
  author: null,
  equipment: 'V60',
  description: null,
  beans: { value: 20, unit: 'g' },
  water: { value: 300, unit: 'g' },
  temperature: { value: 92, unit: 'C' },
  grind: 'coarse',
  totalSec: 210,
  steps: [
    { startSec: 0, name: '1投目', description: null, target: { value: 50, unit: 'g' }, caution: null },
    { startSec: 45, name: '2投目', description: null, target: { value: 300, unit: 'g' }, caution: null },
  ],
}

/** Gemini の返答の形で包む */
function geminiBody(text: string) {
  return { candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface Call {
  url: string
  init: RequestInit
}

/** 決まった返答を返す偽の fetch。呼ばれた中身を calls に残す */
function fakeFetch(respond: () => Response | Promise<Response>): FetchLike & { calls: Call[] } {
  const calls: Call[] = []
  const f = async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return respond()
  }
  return Object.assign(f, { calls })
}

function apiError(status: number, reason?: string, message = 'error', statusText = 'INVALID_ARGUMENT') {
  return {
    error: {
      code: status,
      message,
      status: statusText,
      details: reason ? [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }] : [],
    },
  }
}

describe('readRecipe（Gemini で読み取る）', () => {
  it('キーは URL に入れず、ヘッダー x-goog-api-key で渡す', async () => {
    const fetch = fakeFetch(() => jsonResponse(200, geminiBody(JSON.stringify(recipeJson))))
    await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch })
    expect(fetch.calls).toHaveLength(1)
    const { url, init } = fetch.calls[0]
    expect(url).toBe(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`)
    expect(url).not.toContain(KEY)
    expect(url).not.toContain('key=')
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('x-goog-api-key')).toBe(KEY)
    expect(headers.get('content-type')).toBe('application/json')
    const body = JSON.parse(String(init.body))
    expect(body.contents[0].parts[0]).toEqual({ file_data: { file_uri: VIDEO } })
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toBeDefined()
    expect(String(init.body)).not.toContain(KEY)
  })

  it('200 と正しい返答で下書きが返る（動画の URL が入る）', async () => {
    const fetch = fakeFetch(() => jsonResponse(200, geminiBody(JSON.stringify(recipeJson))))
    const r = await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.draft.name).toBe('4:6メソッド')
    expect(r.draft.videoUrl).toBe(VIDEO)
    expect(r.draft.grind).toBe('粗挽き')
    expect(r.draft.steps).toHaveLength(2)
  })

  it('返答の文字がいくつかに分かれていてもつなげて読む', async () => {
    const text = JSON.stringify(recipeJson)
    const fetch = fakeFetch(() =>
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: text.slice(0, 20) }, { text: text.slice(20) }] } }],
      }),
    )
    const r = await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch })
    expect(r.ok).toBe(true)
  })

  it('文章のときは file_data を送らず、渡した動画の URL を下書きに入れる', async () => {
    const fetch = fakeFetch(() => jsonResponse(200, geminiBody(JSON.stringify(recipeJson))))
    const r = await readRecipe({ input: { kind: 'text', text: '豆20g…' }, videoUrl: VIDEO, apiKey: KEY, fetch })
    expect(String(fetch.calls[0].init.body)).not.toContain('file_data')
    expect(r.ok && r.draft.videoUrl).toBe(VIDEO)
    const r2 = await readRecipe({ input: { kind: 'text', text: '豆20g…' }, apiKey: KEY, fetch })
    expect(r2.ok && r2.draft.videoUrl).toBe('')
  })

  it('キーが空なら送らずに noKey', async () => {
    const fetch = fakeFetch(() => jsonResponse(200, geminiBody('{}')))
    expect(await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: '  ', fetch })).toEqual({
      ok: false,
      error: 'noKey',
    })
    expect(fetch.calls).toHaveLength(0)
  })

  it('fetch が失敗 → network', async () => {
    const fetch: FetchLike = async () => {
      throw new TypeError('Failed to fetch')
    }
    expect(await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch })).toEqual({
      ok: false,
      error: 'network',
    })
  })

  it('400（API_KEY_INVALID）・401・403 → invalidKey', async () => {
    for (const res of [
      () => jsonResponse(400, apiError(400, 'API_KEY_INVALID', 'API key not valid. Please pass a valid API key.')),
      () => jsonResponse(401, apiError(401, undefined, 'unauthenticated', 'UNAUTHENTICATED')),
      () => jsonResponse(403, apiError(403, undefined, 'denied', 'PERMISSION_DENIED')),
    ]) {
      const r = await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch: fakeFetch(res) })
      expect(r).toEqual({ ok: false, error: 'invalidKey' })
    }
  })

  it('429 → quota', async () => {
    const fetch = fakeFetch(() => jsonResponse(429, apiError(429, undefined, 'quota', 'RESOURCE_EXHAUSTED')))
    expect(await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch })).toEqual({
      ok: false,
      error: 'quota',
    })
  })

  it('URL のときのキー以外の 400 → video（動画を開けない）', async () => {
    const fetch = fakeFetch(() => jsonResponse(400, apiError(400, undefined, 'Request contains an invalid argument.')))
    expect(await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch })).toEqual({
      ok: false,
      error: 'video',
    })
    // 本文が JSON でない 400 も同じ
    const fetch2 = fakeFetch(() => new Response('Bad Request', { status: 400 }))
    expect(await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch: fetch2 })).toEqual({
      ok: false,
      error: 'video',
    })
  })

  it('文章のときの 400 は動画のせいではないので broken', async () => {
    const fetch = fakeFetch(() => jsonResponse(400, apiError(400)))
    expect(await readRecipe({ input: { kind: 'text', text: 'abc' }, apiKey: KEY, fetch })).toEqual({
      ok: false,
      error: 'broken',
    })
  })

  it('500・503 など → broken（もう一度試してもらう）', async () => {
    for (const status of [500, 503, 404]) {
      const fetch = fakeFetch(() => jsonResponse(status, apiError(status, undefined, 'x', 'UNAVAILABLE')))
      expect(await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch })).toEqual({
        ok: false,
        error: 'broken',
      })
    }
  })

  it('返答が JSON でない → broken', async () => {
    const cases = [
      () => new Response('<html>oops</html>', { status: 200 }),
      () => jsonResponse(200, geminiBody('レシピは次のとおりです')),
      () => jsonResponse(200, { candidates: [] }),
      () => jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }),
      () => jsonResponse(200, { candidates: [{ content: { parts: [{ text: '{"found": true, "na' }] }, finishReason: 'MAX_TOKENS' }] }),
    ]
    for (const res of cases) {
      const r = await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch: fakeFetch(res) })
      expect(r).toEqual({ ok: false, error: 'broken' })
    }
  })

  it('found: false → notFound', async () => {
    const fetch = fakeFetch(() => jsonResponse(200, geminiBody(JSON.stringify({ found: false, steps: [] }))))
    expect(await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch })).toEqual({
      ok: false,
      error: 'notFound',
    })
  })

  /** 中止されるまで待つ fetch */
  const hangingFetch: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })

  it('中止 → cancelled', async () => {
    const ctrl = new AbortController()
    const p = readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch: hangingFetch, signal: ctrl.signal })
    ctrl.abort()
    expect(await p).toEqual({ ok: false, error: 'cancelled' })
  })

  it('始める前に中止されていれば送らずに cancelled', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const fetch = fakeFetch(() => jsonResponse(200, geminiBody(JSON.stringify(recipeJson))))
    expect(
      await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch, signal: ctrl.signal }),
    ).toEqual({ ok: false, error: 'cancelled' })
    expect(fetch.calls).toHaveLength(0)
  })

  it('返答を受け取った後に中止されても cancelled', async () => {
    const ctrl = new AbortController()
    const fetch = fakeFetch(() => {
      ctrl.abort()
      return jsonResponse(200, geminiBody(JSON.stringify(recipeJson)))
    })
    expect(
      await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch, signal: ctrl.signal }),
    ).toEqual({ ok: false, error: 'cancelled' })
  })

  it('時間の上限を過ぎたら打ち切って timeout', async () => {
    const r = await readRecipe({ input: { kind: 'url', url: VIDEO }, apiKey: KEY, fetch: hangingFetch, timeoutMs: 20 })
    expect(r).toEqual({ ok: false, error: 'timeout' })
  })
})
