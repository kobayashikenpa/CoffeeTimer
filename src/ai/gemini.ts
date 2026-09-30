// Gemini API の呼び出し（読み取り・キーの確かめ）とエラーの振り分け（仕様 6.2〜6.4、architecture.md 4.1・4.2）
// APIキーは URL・ログ・エラーに入れず、ヘッダー x-goog-api-key でだけ渡す
import { normalizeAiResult } from '../engine/aiResult'
import type { RecipeDraft } from '../engine/types'
import { GEMINI_API_BASE, GEMINI_MODEL } from './model'
import { buildRequest } from './prompt'
import type { ReadInput } from './prompt'

/** fetch と同じ呼び方ができるもの（テストでは偽物に差し替える） */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** 読み取りの時間の上限（暫定：3分） */
export const READ_TIMEOUT_MS = 3 * 60 * 1000

/**
 * 読み取りがうまくいかなかった理由（仕様 6.3）。
 * noKey：キー未設定 / invalidKey：キーが正しくない / quota：無料枠の上限 / video：動画を開けない /
 * notFound：レシピが見つからない / network：通信できない / broken：返答の形が壊れている /
 * timeout：時間の上限を過ぎた（暫定） / cancelled：利用者が「やめる」を押した
 */
export type ReadErrorKind =
  | 'noKey'
  | 'invalidKey'
  | 'quota'
  | 'video'
  | 'notFound'
  | 'network'
  | 'broken'
  | 'timeout'
  | 'cancelled'

export type ReadResult = { ok: true; draft: RecipeDraft } | { ok: false; error: ReadErrorKind }

const defaultFetch: FetchLike = (url, init) => globalThis.fetch(url, init)

function headers(apiKey: string, json: boolean): Record<string, string> {
  const h: Record<string, string> = { 'x-goog-api-key': apiKey }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

/** エラーの返答の本文から、理由（reason）・状態・文を取り出す（読めなければ空） */
async function errorInfo(res: Response): Promise<{ reasons: string[]; status: string; message: string }> {
  try {
    const body: unknown = await res.json()
    const err = (body as { error?: { status?: unknown; message?: unknown; details?: unknown } } | null)?.error
    const details = Array.isArray(err?.details) ? err.details : []
    const reasons = details
      .map((d: unknown) => (d as { reason?: unknown } | null)?.reason)
      .filter((r): r is string => typeof r === 'string')
    return {
      reasons,
      status: typeof err?.status === 'string' ? err.status : '',
      message: typeof err?.message === 'string' ? err.message : '',
    }
  } catch {
    return { reasons: [], status: '', message: '' }
  }
}

/** キーが正しくないことを示す 400 か */
function isKeyError(info: { reasons: string[]; status: string; message: string }): boolean {
  return (
    info.reasons.some((r) => r === 'API_KEY_INVALID' || r === 'API_KEY_EXPIRED' || r === 'API_KEY_SERVICE_BLOCKED') ||
    info.status === 'UNAUTHENTICATED' ||
    /api[ _]?key/i.test(info.message)
  )
}

/**
 * うまくいかなかった HTTP の返答を振り分ける。
 * 401・403・キーの 400 → invalidKey、429 → quota、
 * キー以外の 400 → 動画のとき video（暫定：Gemini は動画を開けないとき 400 を返すと見て）、文章のとき broken、
 * そのほか（500・503 など）→ broken
 */
async function classifyHttpError(res: Response, inputKind: ReadInput['kind']): Promise<ReadErrorKind> {
  if (res.status === 401 || res.status === 403) return 'invalidKey'
  if (res.status === 429) return 'quota'
  if (res.status === 400) {
    const info = await errorInfo(res)
    if (isKeyError(info)) return 'invalidKey'
    return inputKind === 'url' ? 'video' : 'broken'
  }
  return 'broken'
}

/** generateContent の返答から、AI が書いた文字を取り出す。無ければ null */
function responseText(body: unknown): string | null {
  const candidates = (body as { candidates?: unknown } | null)?.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const parts = (candidates[0] as { content?: { parts?: unknown } } | null)?.content?.parts
  if (!Array.isArray(parts)) return null
  const text = parts
    .map((p: unknown) => (p as { text?: unknown } | null)?.text)
    .filter((t): t is string => typeof t === 'string')
    .join('')
  return text === '' ? null : text
}

export interface ReadRecipeOptions {
  input: ReadInput
  apiKey: string
  /** 下書きに入れる動画の URL。省くと、URL のときはその URL、文章のときは空 */
  videoUrl?: string
  fetch?: FetchLike
  /** 「やめる」で中止する */
  signal?: AbortSignal
  /** 時間の上限（ミリ秒）。既定は 3分 */
  timeoutMs?: number
}

/**
 * Gemini で動画（または文章）からレシピを読み取り、確認・編集画面の下書きにする。
 * 例外は投げず、うまくいかなかったときは理由（ReadErrorKind）を返す
 */
export async function readRecipe(opts: ReadRecipeOptions): Promise<ReadResult> {
  const { input, signal } = opts
  const apiKey = opts.apiKey.trim()
  const fetch = opts.fetch ?? defaultFetch
  if (apiKey === '') return { ok: false, error: 'noKey' }
  if (signal?.aborted) return { ok: false, error: 'cancelled' }

  // 「やめる」と時間の上限の、どちらでも止められるようにする
  const ctrl = new AbortController()
  let timedOut = false
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, opts.timeoutMs ?? READ_TIMEOUT_MS)
  const stopped = (): ReadResult | null => {
    if (signal?.aborted) return { ok: false, error: 'cancelled' }
    if (timedOut) return { ok: false, error: 'timeout' }
    return null
  }

  try {
    let res: Response
    try {
      res = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: headers(apiKey, true),
        body: JSON.stringify(buildRequest(input)),
        signal: ctrl.signal,
      })
    } catch {
      return stopped() ?? { ok: false, error: 'network' }
    }
    if (!res.ok) {
      const kind = await classifyHttpError(res, input.kind)
      return stopped() ?? { ok: false, error: kind }
    }
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return stopped() ?? { ok: false, error: 'broken' }
    }
    const halted = stopped()
    if (halted) return halted
    const text = responseText(body)
    if (text === null) return { ok: false, error: 'broken' }
    const videoUrl = opts.videoUrl ?? (input.kind === 'url' ? input.url : '')
    const result = normalizeAiResult(text, { videoUrl })
    return result.ok ? result : { ok: false, error: result.reason }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * キーを確かめた結果（仕様 6.4・11）。
 * ok：使える / invalidKey：正しくない / quota：上限 / network：通信できない / unknown：そのほか（暫定）
 */
export type KeyCheckResult = 'ok' | 'invalidKey' | 'quota' | 'network' | 'unknown'

/**
 * キーが使えるかを試す。回数の少ない、モデルの情報を取る GET をヘッダーつきで呼ぶ（暫定）。
 * 200 なら使える。例外は投げない
 */
export async function checkApiKey(opts: { apiKey: string; fetch?: FetchLike; signal?: AbortSignal }): Promise<KeyCheckResult> {
  const apiKey = opts.apiKey.trim()
  if (apiKey === '') return 'invalidKey'
  const fetch = opts.fetch ?? defaultFetch
  let res: Response
  try {
    res = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}`, {
      method: 'GET',
      headers: headers(apiKey, false),
      signal: opts.signal,
    })
  } catch {
    return 'network'
  }
  if (res.ok) return 'ok'
  if (res.status === 400 || res.status === 401 || res.status === 403) return 'invalidKey'
  if (res.status === 429) return 'quota'
  return 'unknown'
}
