// 確認・編集画面の入力欄（文字）と下書き（RecipeDraft）の行き来
// 入力中の文字（例「1:3」）を保つため、画面では文字で持ち、確かめるときに下書きにする
import { parseDecimal } from '../../engine/number'
import { sortSteps } from '../../engine/recipe'
import { formatTime, parseTime } from '../../engine/time'
import type { Grind, RecipeDraft, ValidationIssue } from '../../engine/types'

export interface StepForm {
  /** 画面の中で手順を見分ける印（並べ替えても入力欄がずれないように） */
  key: string
  start: string
  name: string
  description: string
  target: string
  caution: boolean
  cautionText: string
}

export interface RecipeForm {
  id: string | null
  name: string
  author: string
  videoUrl: string
  equipment: string
  beans: string
  water: string
  temp: string
  grind: Grind | null
  description: string
  total: string
  steps: StepForm[]
  favorite: boolean
}

let keySeq = 0
function newKey(): string {
  keySeq += 1
  return `s${keySeq}`
}

const numText = (n: number | null) => (n === null ? '' : String(n))
const timeText = (n: number | null) => (n === null ? '' : formatTime(n))

/** 空の手順の入力欄 */
export function emptyStepForm(start = ''): StepForm {
  return { key: newKey(), start, name: '', description: '', target: '', caution: false, cautionText: '' }
}

/** 新しいレシピ（手で入れる）の下書き：最初の手順（開始 0:00）だけがある */
export function emptyDraft(): RecipeDraft {
  return {
    id: null,
    name: '',
    author: '',
    videoUrl: '',
    equipment: '',
    beansG: null,
    waterG: null,
    tempC: null,
    grind: null,
    description: '',
    totalSec: null,
    steps: [{ startSec: 0, name: '', description: '', targetG: null, caution: false, cautionText: '' }],
    favorite: false,
  }
}

export function draftToForm(draft: RecipeDraft): RecipeForm {
  return {
    id: draft.id,
    name: draft.name,
    author: draft.author,
    videoUrl: draft.videoUrl,
    equipment: draft.equipment,
    beans: numText(draft.beansG),
    water: numText(draft.waterG),
    temp: numText(draft.tempC),
    grind: draft.grind,
    description: draft.description,
    total: timeText(draft.totalSec),
    steps: draft.steps.map((s) => ({
      key: newKey(),
      start: timeText(s.startSec),
      name: s.name,
      description: s.description,
      target: numText(s.targetG),
      caution: s.caution,
      cautionText: s.cautionText,
    })),
    favorite: draft.favorite,
  }
}

/** 入力欄を下書きにする。数・時刻として読めない文字は formatErrors に入れ、下書きでは空（null）にする */
export function formToDraft(form: RecipeForm): { draft: RecipeDraft; formatErrors: ValidationIssue[] } {
  const formatErrors: ValidationIssue[] = []
  const num = (text: string, field: string): number | null => {
    if (text.trim() === '') return null
    const n = parseDecimal(text)
    if (n === null) formatErrors.push({ field, message: '数字で入れてください（例 15）' })
    return n
  }
  const time = (text: string, field: string): number | null => {
    if (text.trim() === '') return null
    const n = parseTime(text)
    if (n === null) formatErrors.push({ field, message: '「分:秒」（例 1:30）か、秒（例 90）で入れてください' })
    return n
  }
  const draft: RecipeDraft = {
    id: form.id,
    name: form.name,
    author: form.author,
    videoUrl: form.videoUrl.trim(),
    equipment: form.equipment,
    beansG: num(form.beans, 'beansG'),
    waterG: num(form.water, 'waterG'),
    tempC: num(form.temp, 'tempC'),
    grind: form.grind,
    description: form.description,
    totalSec: time(form.total, 'totalSec'),
    steps: form.steps.map((s, i) => ({
      startSec: time(s.start, `steps.${i}.startSec`),
      name: s.name,
      description: s.description,
      targetG: num(s.target, `steps.${i}.targetG`),
      caution: s.caution,
      cautionText: s.caution ? s.cautionText : '',
    })),
    favorite: form.favorite,
  }
  return { draft, formatErrors }
}

/** 手順を開始の時刻の順に並べる（時刻が空・読めないものは最後） */
export function sortStepForms(steps: readonly StepForm[]): StepForm[] {
  return sortSteps(steps.map((s) => ({ s, startSec: parseTime(s.start) }))).map((x) => x.s)
}

/**
 * 形の誤り（読めない文字）と、engine の確かめの結果をまとめる。
 * 同じ項目に形の誤りがあれば、そちらだけを出す（「入れてください」と重ねない）
 */
export function mergeIssues(formatErrors: ValidationIssue[], errors: ValidationIssue[]): ValidationIssue[] {
  const fields = new Set(formatErrors.map((e) => e.field))
  return [...formatErrors, ...errors.filter((e) => !fields.has(e.field))]
}
