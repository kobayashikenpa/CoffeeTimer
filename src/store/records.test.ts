import { describe, expect, it } from 'vitest'
import { createRecordDraft, toRecord } from '../engine/record'
import { scaleRecipe } from '../engine/scale'
import type { BrewRecord, Recipe } from '../engine/types'
import { createRecipeStore } from './recipes'
import { RECORDS_KEY, createRecordStore } from './records'
import { brokenKey } from './storage'
import { memoryStorage, throwingStorage } from './testStorage'

const recipe: Recipe = {
  id: 'r1',
  name: '基本のハンドドリップ',
  author: '',
  videoUrl: '',
  equipment: 'V60',
  beansG: 15,
  waterG: 250,
  tempC: null,
  grind: null,
  description: '',
  totalSec: 180,
  steps: [{ startSec: 0, name: '蒸らし', description: '', targetG: 250, caution: false, cautionText: '' }],
  favorite: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

function makeRecord(id: string, brewedAt: string, over: Partial<BrewRecord> = {}): BrewRecord {
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

const fixedNow = () => new Date('2026-09-30T09:00:00.000Z')

describe('淹れた記録の保存', () => {
  it('保存して開き直しても読める（豆の量を 20g に変えた記録は 20g・333g のまま）', () => {
    const storage = memoryStorage()
    const store = createRecordStore(storage, fixedNow)
    const scaled = scaleRecipe(recipe, 20)
    const draft = { ...createRecordDraft(recipe, scaled.beansG, scaled.waterG, '2026-09-30T08:15:00.000Z'), rating: 5 as const }
    expect(store.save(toRecord(draft, { id: 'x1', nowIso: '2026-09-30T08:16:00.000Z' }))).toBe(true)

    const reopened = createRecordStore(memoryStorage(storage.data))
    expect(reopened.list()).toHaveLength(1)
    expect(reopened.get('x1')).toMatchObject({ beansG: 20, waterG: 333, rating: 5, updatedAt: '2026-09-30T09:00:00.000Z' })
    expect(reopened.recoveredFromBroken).toBe(false)
  })

  it('一覧は新しい順。同じ ID を保存すると置き換わる', () => {
    const store = createRecordStore(memoryStorage(), fixedNow)
    store.save(makeRecord('a', '2026-09-28T08:00:00.000Z'))
    store.save(makeRecord('b', '2026-09-30T08:00:00.000Z'))
    store.save(makeRecord('c', '2026-09-29T08:00:00.000Z'))
    expect(store.list().map((r) => r.id)).toEqual(['b', 'c', 'a'])
    store.save(makeRecord('a', '2026-10-01T08:00:00.000Z', { memo: '直した' }))
    expect(store.list().map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(store.get('a')?.memo).toBe('直した')
  })

  it('削除でその記録だけが消える', () => {
    const storage = memoryStorage()
    const store = createRecordStore(storage, fixedNow)
    store.save(makeRecord('a', '2026-09-28T08:00:00.000Z'))
    store.save(makeRecord('b', '2026-09-29T08:00:00.000Z'))
    expect(store.remove('a')).toBe(true)
    expect(createRecordStore(memoryStorage(storage.data)).list().map((r) => r.id)).toEqual(['b'])
  })

  it('レシピを消しても記録は残り、レシピ名が読める', () => {
    const storage = memoryStorage()
    const recipes = createRecipeStore(storage)
    const records = createRecordStore(storage, fixedNow)
    recipes.save(recipe)
    records.save(makeRecord('a', '2026-09-28T08:00:00.000Z'))
    recipes.remove('r1')

    const reopenedRecipes = createRecipeStore(memoryStorage(storage.data))
    const reopenedRecords = createRecordStore(memoryStorage(storage.data))
    expect(reopenedRecipes.get('r1')).toBeUndefined()
    expect(reopenedRecords.get('a')?.recipeName).toBe('基本のハンドドリップ')
  })

  it('変更を知らせ、変更が無ければ同じ配列を返す', () => {
    const store = createRecordStore(memoryStorage(), fixedNow)
    let calls = 0
    store.subscribe(() => calls++)
    const first = store.list()
    expect(store.list()).toBe(first)
    store.save(makeRecord('a', '2026-09-28T08:00:00.000Z'))
    expect(store.list()).not.toBe(first)
    expect(calls).toBe(1)
  })

  it('壊れた中身は退避して空で始める', () => {
    const storage = memoryStorage()
    storage.setItem(RECORDS_KEY, '{"version":1,"items":[{"id":1}]}')
    const store = createRecordStore(storage)
    expect(store.list()).toEqual([])
    expect(store.recoveredFromBroken).toBe(true)
    expect(storage.getItem(brokenKey(RECORDS_KEY))).toBe('{"version":1,"items":[{"id":1}]}')
  })

  it('使えない保存先でも止まらない（その間だけ使える）', () => {
    const store = createRecordStore(throwingStorage(), fixedNow)
    expect(store.save(makeRecord('a', '2026-09-28T08:00:00.000Z'))).toBe(false)
    expect(store.list()).toHaveLength(1)
  })

  it('replaceAll は全体を置き換え、updatedAt を変えない', () => {
    const store = createRecordStore(memoryStorage(), fixedNow)
    store.save(makeRecord('a', '2026-09-28T08:00:00.000Z'))
    const b = makeRecord('b', '2026-09-29T08:00:00.000Z')
    expect(store.replaceAll([b])).toBe(true)
    expect(store.list()).toEqual([b])
  })
})
