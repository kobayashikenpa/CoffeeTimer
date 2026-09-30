// 淹れた記録の下書き・確かめ・並び・絞り込み（仕様 9、architecture.md 4.5）
import type { BrewRecord, Recipe, ValidationIssue } from './types'

/** 記録をつける画面・直す画面で使う下書き。新しい記録なら id は null */
export type RecordDraft = Omit<BrewRecord, 'id' | 'updatedAt'> & { id: string | null }

/** 評価として受け付ける値 */
export const RATINGS = [1, 2, 3, 4, 5] as const

/**
 * タイマーの完成後に「記録をつける」で開く下書き。
 * 日時・レシピ（ID と名前）・豆の量・湯量を自動で入れる（豆の量を変えて淹れたときは、そのときの値を渡す）
 */
export function createRecordDraft(
  recipe: Pick<Recipe, 'id' | 'name'>,
  beansG: number,
  waterG: number,
  nowIso: string,
): RecordDraft {
  return {
    id: null,
    brewedAt: nowIso,
    recipeId: recipe.id,
    recipeName: recipe.name,
    beansG,
    waterG,
    beanName: '',
    rating: null,
    memo: '',
  }
}

/** 日時の文字（ISO 8601）として読めるか */
export function isValidDateTime(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) && !Number.isNaN(Date.parse(iso))
}

/** 評価が 1〜5 の整数か空か */
export function isRating(v: unknown): v is BrewRecord['rating'] {
  return v === null || (RATINGS as readonly unknown[]).includes(v)
}

/** 記録を確かめる。問題が無ければ空の並び */
export function validateRecord(draft: RecordDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!isValidDateTime(draft.brewedAt)) issues.push({ field: 'brewedAt', message: '日時を正しく入れてください' })
  if (!isRating(draft.rating)) issues.push({ field: 'rating', message: '評価は ★1〜5 か、なしにしてください' })
  return issues
}

/** 確かめを通った下書きを、保存する記録にする。エラーがあれば例外（先に validateRecord で確かめること） */
export function toRecord(draft: RecordDraft, opts: { id: string; nowIso: string }): BrewRecord {
  const issues = validateRecord(draft)
  if (issues.length > 0) throw new Error(`保存できない記録です：${issues.map((i) => i.field).join(', ')}`)
  return {
    id: opts.id,
    brewedAt: new Date(draft.brewedAt).toISOString(),
    recipeId: draft.recipeId,
    recipeName: draft.recipeName,
    beansG: draft.beansG,
    waterG: draft.waterG,
    beanName: draft.beanName.trim(),
    rating: draft.rating,
    memo: draft.memo,
    updatedAt: opts.nowIso,
  }
}

/** 保存した記録を、直す画面で開くための下書きにする */
export function recordToDraft(record: BrewRecord): RecordDraft {
  const { updatedAt: _updatedAt, ...rest } = record
  return { ...rest }
}

function time(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** 新しい順（日時が同じなら、あとで直したほうが上）。元の並びは変えない */
export function sortRecords<T extends Pick<BrewRecord, 'brewedAt' | 'updatedAt'>>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => time(b.brewedAt) - time(a.brewedAt) || time(b.updatedAt) - time(a.updatedAt))
}

/** レシピで絞り込む。recipeId が null ならすべて */
export function filterByRecipe<T extends Pick<BrewRecord, 'recipeId'>>(records: readonly T[], recipeId: string | null): T[] {
  return recipeId === null ? [...records] : records.filter((r) => r.recipeId === recipeId)
}

/** 絞り込みの選択肢1つ */
export interface RecordRecipeOption {
  recipeId: string
  /** 今あるレシピは今の名前、消したレシピは記録に残した名前（いちばん新しい記録のもの） */
  name: string
  /** レシピが消されているか */
  deleted: boolean
  /** そのレシピの記録の数 */
  count: number
}

/**
 * 記録の絞り込みの選択肢。記録があるレシピだけを、いちばん新しい記録の順に出す。
 * 消したレシピも、記録に残した名前で選べる
 */
export function recordRecipeOptions(
  records: readonly BrewRecord[],
  recipes: readonly Pick<Recipe, 'id' | 'name'>[],
): RecordRecipeOption[] {
  const byId = new Map<string, RecordRecipeOption>()
  for (const r of sortRecords(records)) {
    const existing = byId.get(r.recipeId)
    if (existing) {
      existing.count += 1
      continue
    }
    const recipe = recipes.find((x) => x.id === r.recipeId)
    byId.set(r.recipeId, {
      recipeId: r.recipeId,
      name: recipe ? recipe.name : r.recipeName,
      deleted: !recipe,
      count: 1,
    })
  }
  return [...byId.values()]
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO の日時を、日時の入力欄（datetime-local）の文字（端末の時刻 YYYY-MM-DDTHH:mm）にする。読めなければ '' */
export function toLocalInput(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 日時の入力欄の文字（端末の時刻）を ISO の日時にする。読めない・無い日付（2月30日など）は null */
export function fromLocalInput(text: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim())
  if (!m) return null
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number)
  const date = new Date(y, mo - 1, d, h, mi, s)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== mi
  )
    return null
  return date.toISOString()
}

/** 一覧に出す日時（端末の時刻で 2026/9/30 8:05）。読めなければ — */
export function formatBrewedAt(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const d = new Date(t)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${pad(d.getMinutes())}`
}
