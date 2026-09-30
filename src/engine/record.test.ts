import { describe, expect, it } from 'vitest'
import {
  createRecordDraft,
  filterByRecipe,
  formatBrewedAt,
  fromLocalInput,
  recordRecipeOptions,
  recordToDraft,
  sortRecords,
  toLocalInput,
  toRecord,
  validateRecord,
} from './record'
import type { RecordDraft } from './record'
import { scaleRecipe } from './scale'
import type { BrewRecord, Recipe } from './types'

const recipe: Recipe = {
  id: 'r1',
  name: '基本のハンドドリップ',
  author: '',
  videoUrl: '',
  equipment: 'V60',
  beansG: 15,
  waterG: 250,
  tempC: 92,
  grind: '中細挽き',
  description: '',
  totalSec: 180,
  steps: [
    { startSec: 0, name: '蒸らし', description: '', targetG: 50, caution: false, cautionText: '' },
    { startSec: 40, name: '1投目', description: '', targetG: 250, caution: false, cautionText: '' },
  ],
  favorite: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const NOW = '2026-09-30T08:15:00.000Z'

function rec(id: string, brewedAt: string, over: Partial<BrewRecord> = {}): BrewRecord {
  return {
    id,
    brewedAt,
    recipeId: 'r1',
    recipeName: '基本のハンドドリップ',
    beansG: 15,
    waterG: 250,
    beanName: '',
    rating: null,
    memo: '',
    updatedAt: brewedAt,
    ...over,
  }
}

describe('createRecordDraft（仕様 9.1）', () => {
  it('日時・レシピの ID と名前・豆の量・湯量を自動で入れる。ほかは空', () => {
    expect(createRecordDraft(recipe, 15, 250, NOW)).toEqual({
      id: null,
      brewedAt: NOW,
      recipeId: 'r1',
      recipeName: '基本のハンドドリップ',
      beansG: 15,
      waterG: 250,
      beanName: '',
      rating: null,
      memo: '',
    })
  })

  it('豆の量を 20g に変えて淹れたときは 20g・333g が入る（仕様 8.2 の例）', () => {
    const scaled = scaleRecipe(recipe, 20)
    const d = createRecordDraft(recipe, scaled.beansG, scaled.waterG, NOW)
    expect(d.beansG).toBe(20)
    expect(d.waterG).toBe(333)
  })
})

describe('validateRecord', () => {
  const ok = createRecordDraft(recipe, 15, 250, NOW)

  it('自動で入れた値だけなら問題なし', () => {
    expect(validateRecord(ok)).toEqual([])
  })

  it('評価は 1〜5 か空', () => {
    for (const r of [1, 2, 3, 4, 5, null] as const) expect(validateRecord({ ...ok, rating: r })).toEqual([])
    for (const bad of [0, 6, 2.5, -1]) {
      const issues = validateRecord({ ...ok, rating: bad as unknown as RecordDraft['rating'] })
      expect(issues.map((i) => i.field)).toEqual(['rating'])
    }
  })

  it('日時は正しい日時でないとエラー', () => {
    for (const bad of ['', '2026-13-40T00:00', 'あした']) {
      expect(validateRecord({ ...ok, brewedAt: bad }).map((i) => i.field)).toEqual(['brewedAt'])
    }
  })
})

describe('toRecord・recordToDraft', () => {
  it('下書きを記録にし、日時は ISO の形にそろえる', () => {
    const d: RecordDraft = { ...createRecordDraft(recipe, 15, 250, NOW), beanName: '  エチオピア  ', rating: 4, memo: '甘い' }
    const r = toRecord(d, { id: 'x1', nowIso: '2026-09-30T09:00:00.000Z' })
    expect(r).toEqual({
      id: 'x1',
      brewedAt: NOW,
      recipeId: 'r1',
      recipeName: '基本のハンドドリップ',
      beansG: 15,
      waterG: 250,
      beanName: 'エチオピア',
      rating: 4,
      memo: '甘い',
      updatedAt: '2026-09-30T09:00:00.000Z',
    })
    expect(recordToDraft(r)).toEqual({ ...d, id: 'x1', beanName: 'エチオピア' })
  })

  it('エラーのある下書きは例外', () => {
    expect(() => toRecord({ ...createRecordDraft(recipe, 15, 250, NOW), rating: 9 as never }, { id: 'x', nowIso: NOW })).toThrow()
  })
})

describe('sortRecords・filterByRecipe（仕様 9.2）', () => {
  const a = rec('a', '2026-09-28T08:00:00.000Z')
  const b = rec('b', '2026-09-30T08:00:00.000Z', { recipeId: 'r2', recipeName: '4:6メソッド' })
  const c = rec('c', '2026-09-29T08:00:00.000Z')

  it('新しい順に並べる（元の並びは変えない）', () => {
    const list = [a, b, c]
    expect(sortRecords(list).map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(list.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('日時が同じなら、あとで直したほうが上', () => {
    const x = rec('x', '2026-09-30T08:00:00.000Z', { updatedAt: '2026-09-30T09:00:00.000Z' })
    const y = rec('y', '2026-09-30T08:00:00.000Z', { updatedAt: '2026-09-30T10:00:00.000Z' })
    expect(sortRecords([x, y]).map((r) => r.id)).toEqual(['y', 'x'])
  })

  it('レシピで絞り込む。null ならすべて', () => {
    expect(filterByRecipe([a, b, c], 'r1').map((r) => r.id)).toEqual(['a', 'c'])
    expect(filterByRecipe([a, b, c], 'r2').map((r) => r.id)).toEqual(['b'])
    expect(filterByRecipe([a, b, c], null)).toHaveLength(3)
    expect(filterByRecipe([a, b, c], 'none')).toEqual([])
  })
})

describe('recordRecipeOptions（絞り込みの選択肢）', () => {
  it('記録があるレシピだけを、新しい記録の順に出す。今あるレシピは今の名前、消したレシピは記録の名前（新しい記録の名前）', () => {
    const records = [
      rec('a', '2026-09-28T08:00:00.000Z', { recipeId: 'r1', recipeName: '古い名前' }),
      rec('b', '2026-09-30T08:00:00.000Z', { recipeId: 'gone', recipeName: '消したレシピ（新）' }),
      rec('c', '2026-09-20T08:00:00.000Z', { recipeId: 'gone', recipeName: '消したレシピ（旧）' }),
    ]
    const opts = recordRecipeOptions(records, [recipe, { ...recipe, id: 'r9', name: '記録なし' }])
    expect(opts).toEqual([
      { recipeId: 'gone', name: '消したレシピ（新）', deleted: true, count: 2 },
      { recipeId: 'r1', name: '基本のハンドドリップ', deleted: false, count: 1 },
    ])
  })
  it('記録が無ければ空', () => {
    expect(recordRecipeOptions([], [recipe])).toEqual([])
  })
})

describe('日時の入力欄との行き来', () => {
  it('toLocalInput → fromLocalInput で同じ時刻（分まで）に戻る', () => {
    const local = toLocalInput(NOW)
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(fromLocalInput(local)).toBe(NOW)
  })
  it('読めない入力は null', () => {
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('abc')).toBeNull()
    expect(fromLocalInput('2026-02-30T10:00')).toBeNull()
  })
  it('壊れた ISO は空の入力欄にする', () => {
    expect(toLocalInput('bad')).toBe('')
  })
})

describe('formatBrewedAt', () => {
  it('年/月/日 時:分 で出す（端末の時刻で）', () => {
    const d = new Date(2026, 8, 30, 8, 5)
    expect(formatBrewedAt(d.toISOString())).toBe('2026/9/30 8:05')
  })
  it('壊れた日時は —', () => {
    expect(formatBrewedAt('x')).toBe('—')
  })
})
