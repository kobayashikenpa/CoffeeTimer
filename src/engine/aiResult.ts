// AI の返答の検証と、確認・編集画面の下書きへの変換（仕様 6.2・6.3、architecture.md 4.1）
// AI の返答は信用しない。形・型・値の範囲を確かめ、直せるものは直し、直せない値は空（null）にする
import { sortSteps } from './recipe'
import type { Grind, RecipeDraft, StepDraft } from './types'

/**
 * AI の返答で受け入れる値の範囲（暫定。tasks.md 未決事項 5）。
 * [下限, 上限]（どちらも含む）。範囲の外の値は空にする
 */
export const AI_LIMITS = {
  beansG: [0.5, 200],
  waterG: [1, 5000],
  tempC: [0, 100],
  /** 時刻（手順の開始・完成時刻）の上限（秒） */
  maxSec: 3600,
} as const

/** 手順の数の上限（暫定。極端に長い返答で画面が重くならないように） */
export const AI_MAX_STEPS = 30

/** 文字の長さの上限（暫定） */
const MAX_LEN = {
  name: 100,
  author: 100,
  equipment: 100,
  description: 300,
  stepName: 50,
  stepDescription: 300,
  caution: 100,
} as const

/** 1 oz = 28.35 g */
const G_PER_OZ = 28.35

/** 挽き目の英語の値 → 日本語 */
const GRIND_MAP: Record<string, Grind> = {
  extra_fine: '極細挽き',
  fine: '細挽き',
  medium_fine: '中細挽き',
  medium: '中挽き',
  coarse: '粗挽き',
}

export type AiResult = { ok: true; draft: RecipeDraft } | { ok: false; reason: 'notFound' | 'broken' }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 有限の数だけを数として読む（文字の '300' などは読まない） */
function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 範囲の中なら値、外なら null */
function inRange(v: number, [min, max]: readonly [number, number]): number | null {
  return v >= min && v <= max ? v : null
}

/**
 * 文字を整える：制御文字を除き、前後の空白を省き、長すぎれば切る。
 * multiline でなければ改行も空白にする。文字でなければ空文字
 */
function text(v: unknown, maxLen: number, multiline = false): string {
  if (typeof v !== 'string') return ''
  let t = multiline ? v.replace(/\r\n?/g, '\n') : v.replace(/[\r\n\t]+/g, ' ')
  // 制御文字（改行は残す場合あり）を除く
  // oxlint-disable-next-line no-control-regex
  t = t.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '')
  t = t.trim()
  return [...t].slice(0, maxLen).join('')
}

/** 単位の表記をそろえる（'G'・'grams' → 'g'、'℉' → 'f' など） */
function unitOf(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const u = v.trim().toLowerCase()
  if (['g', 'gram', 'grams', 'グラム'].includes(u)) return 'g'
  if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'cc'].includes(u)) return 'ml'
  if (['oz', 'ounce', 'ounces', 'fl oz', 'floz'].includes(u)) return 'oz'
  if (['c', '℃', '°c', 'celsius'].includes(u)) return 'c'
  if (['f', '℉', '°f', 'fahrenheit'].includes(u)) return 'f'
  return null
}

/** { value, unit } の重さを g にする（ml は 1ml = 1g（暫定）、oz は 28.35g）。読めなければ null */
function weightG(v: unknown, allowMl: boolean): number | null {
  if (!isObject(v)) return null
  const value = finite(v.value)
  const unit = unitOf(v.unit)
  if (value === null) return null
  if (unit === 'g') return value
  if (unit === 'ml' && allowMl) return value
  if (unit === 'oz') return value * G_PER_OZ
  return null
}

/** 豆の量：g にして小数第1位に丸め、範囲の外なら null */
function beans(v: unknown): number | null {
  const g = weightG(v, false)
  return g === null ? null : inRange(Math.round(g * 10) / 10, AI_LIMITS.beansG)
}

/** 湯量・目標量：g にして 1g 単位に丸め、範囲の外なら null */
function water(v: unknown): number | null {
  const g = weightG(v, true)
  return g === null ? null : inRange(Math.round(g), AI_LIMITS.waterG)
}

/** 湯温：℃ にして 1℃ 単位に丸め、範囲の外なら null。℃ = (℉ − 32) × 5 ÷ 9 */
function temperature(v: unknown): number | null {
  if (!isObject(v)) return null
  const value = finite(v.value)
  const unit = unitOf(v.unit)
  if (value === null) return null
  const c = unit === 'c' ? value : unit === 'f' ? ((value - 32) * 5) / 9 : null
  return c === null ? null : inRange(Math.round(c), AI_LIMITS.tempC)
}

/** 時刻（秒）：整数に丸め、min〜上限の外なら null */
function seconds(v: unknown, min: number): number | null {
  const n = finite(v)
  return n === null ? null : inRange(Math.round(n), [min, AI_LIMITS.maxSec])
}

function grind(v: unknown): Grind | null {
  return typeof v === 'string' && Object.hasOwn(GRIND_MAP, v) ? GRIND_MAP[v] : null
}

/** 手順1つ。中身が何も無い（名前・説明・目標量・注意がどれも無い）ものは null（除く） */
function step(v: unknown): StepDraft | null {
  if (!isObject(v)) return null
  const name = text(v.name, MAX_LEN.stepName)
  const description = text(v.description, MAX_LEN.stepDescription, true)
  const targetG = water(v.target)
  const cautionText = text(v.caution, MAX_LEN.caution)
  if (name === '' && description === '' && targetG === null && cautionText === '') return null
  return {
    startSec: seconds(v.startSec, 0),
    name,
    description,
    targetG,
    caution: cautionText !== '',
    cautionText,
  }
}

function parseJson(input: unknown): unknown {
  if (typeof input !== 'string') return input
  try {
    return JSON.parse(input)
  } catch {
    return undefined
  }
}

/**
 * AI の返答（JSON の文字、または読んだ値）を確かめて、確認・編集画面の下書きにする。
 * - JSON でない・形が大きく違う（found が真偽値でない、手順が並びでない など）→ broken
 * - found が false、または読めた中身が何も無い → notFound
 * - 単位を g・℃ に直す（oz→g、℉→℃、ml→g）。範囲の外・型の違う値は空（null）にする
 * - 手順は開始の時刻で並べる（開始の時刻が読めない手順は空にして最後に置く）。
 *   手順名が無くても中身があれば名前を空にして残す（確認・編集画面で入れてもらう）
 * - 手順が1つも読めなければ、開始 0:00 の空の手順を1つ置く
 * 動画の URL は AI の返答からは取らず、呼ぶ側が opts.videoUrl で渡す
 */
export function normalizeAiResult(input: unknown, opts: { videoUrl?: string } = {}): AiResult {
  const v = parseJson(input)
  if (!isObject(v) || typeof v.found !== 'boolean') return { ok: false, reason: 'broken' }
  if (!v.found) return { ok: false, reason: 'notFound' }
  if (!Array.isArray(v.steps)) return { ok: false, reason: 'broken' }

  const steps = sortSteps(
    v.steps
      .slice(0, AI_MAX_STEPS * 2)
      .map(step)
      .filter((s): s is StepDraft => s !== null),
  ).slice(0, AI_MAX_STEPS)

  const draft: RecipeDraft = {
    id: null,
    name: text(v.name, MAX_LEN.name),
    author: text(v.author, MAX_LEN.author),
    videoUrl: opts.videoUrl ?? '',
    equipment: text(v.equipment, MAX_LEN.equipment),
    beansG: beans(v.beans),
    waterG: water(v.water),
    tempC: temperature(v.temperature),
    grind: grind(v.grind),
    description: text(v.description, MAX_LEN.description, true),
    totalSec: seconds(v.totalSec, 1),
    steps,
    favorite: false,
  }

  if (draft.name === '' && draft.beansG === null && draft.waterG === null && steps.length === 0) {
    return { ok: false, reason: 'notFound' }
  }
  if (steps.length === 0) {
    draft.steps = [{ startSec: 0, name: '', description: '', targetG: null, caution: false, cautionText: '' }]
  }
  return { ok: true, draft }
}
