// 端末に保存した中身（localStorage から読んだ JSON）の形を確かめる（architecture.md 3.3）
// 形が違えば null を返す。呼ぶ側（store）は、そのとき元の文字列を退避してから空で始める
import { GRINDS } from './types'
import type { Grind, Recipe, Settings, Step } from './types'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

function toStep(v: unknown): Step | null {
  if (!isObject(v)) return null
  const { startSec, name, description, targetG, caution, cautionText } = v
  if (!isNumber(startSec) || !isString(name) || !isString(description)) return null
  if (!(targetG === null || isNumber(targetG))) return null
  if (!isBool(caution) || !isString(cautionText)) return null
  return { startSec, name, description, targetG, caution, cautionText }
}

/** 保存したレシピ1件の形を確かめる。形が違えば null */
export function toStoredRecipe(v: unknown): Recipe | null {
  if (!isObject(v)) return null
  const { id, name, author, videoUrl, equipment, beansG, waterG, tempC, grind, description, totalSec, steps, favorite, createdAt, updatedAt } = v
  if (!isString(id) || id === '' || !isString(name) || !isString(author) || !isString(videoUrl) || !isString(equipment)) return null
  if (!isNumber(beansG) || beansG <= 0 || !isNumber(waterG) || waterG <= 0 || !isNumber(totalSec)) return null
  if (!(tempC === null || isNumber(tempC))) return null
  if (!(grind === null || (isString(grind) && (GRINDS as readonly string[]).includes(grind)))) return null
  if (!isString(description) || !isBool(favorite) || !isString(createdAt) || !isString(updatedAt)) return null
  if (!Array.isArray(steps) || steps.length === 0) return null
  const parsedSteps: Step[] = []
  for (const s of steps) {
    const step = toStep(s)
    if (!step) return null
    parsedSteps.push(step)
  }
  return {
    id,
    name,
    author,
    videoUrl,
    equipment,
    beansG,
    waterG,
    tempC,
    grind: grind as Grind | null,
    description,
    totalSec,
    steps: parsedSteps,
    favorite,
    createdAt,
    updatedAt,
  }
}

/**
 * 保存したレシピの一覧（`{ version: 1, items: Recipe[] }`）の形を確かめる。
 * 1件でも形が違えば、全体を壊れているとして null（中身を勝手に捨てないため）
 */
export function parseStoredRecipes(v: unknown): Recipe[] | null {
  if (!isObject(v) || v.version !== 1 || !Array.isArray(v.items)) return null
  const items: Recipe[] = []
  for (const item of v.items) {
    const r = toStoredRecipe(item)
    if (!r) return null
    items.push(r)
  }
  return items
}

/** 保存した設定の形を確かめる。形が違えば null */
export function parseStoredSettings(v: unknown): Settings | null {
  if (!isObject(v) || !isBool(v.soundOn) || !isBool(v.speechOn)) return null
  return { soundOn: v.soundOn, speechOn: v.speechOn }
}
