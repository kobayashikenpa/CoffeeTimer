import { describe, expect, it } from 'vitest'
import type { Recipe } from '../engine/types'
import { RECIPES_KEY, createRecipeStore } from './recipes'
import { brokenKey } from './storage'
import { memoryStorage, throwingStorage } from './testStorage'

function makeRecipe(id: string, over: Partial<Recipe> = {}): Recipe {
  return {
    id,
    name: `レシピ${id}`,
    author: '',
    videoUrl: '',
    equipment: 'V60',
    beansG: 15,
    waterG: 250,
    tempC: null,
    grind: null,
    description: '',
    totalSec: 180,
    steps: [{ startSec: 0, name: '蒸らし', description: '', targetG: 50, caution: false, cautionText: '' }],
    favorite: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  }
}

/** 呼ぶたびに1分ずつ進む時計 */
function clock(startIso = '2026-09-30T00:00:00.000Z') {
  let t = new Date(startIso).getTime()
  return () => {
    const d = new Date(t)
    t += 60_000
    return d
  }
}

describe('レシピの保存', () => {
  it('保存 → 開き直しても同じレシピが返る（updatedAt は保存した時刻）', () => {
    const storage = memoryStorage()
    const store = createRecipeStore(storage, clock())
    expect(store.save(makeRecipe('a'))).toBe(true)

    const reopened = createRecipeStore(memoryStorage(storage.data))
    expect(reopened.list()).toHaveLength(1)
    expect(reopened.get('a')).toEqual({ ...makeRecipe('a'), updatedAt: '2026-09-30T00:00:00.000Z' })
    expect(reopened.recoveredFromBroken).toBe(false)
  })

  it('同じ ID を保存すると置き換わる', () => {
    const store = createRecipeStore(memoryStorage(), clock())
    store.save(makeRecipe('a'))
    store.save(makeRecipe('a', { name: '直した名前' }))
    expect(store.list()).toHaveLength(1)
    expect(store.get('a')?.name).toBe('直した名前')
  })

  it('一覧はお気に入りが上、その中は新しく保存した順', () => {
    const store = createRecipeStore(memoryStorage(), clock())
    store.save(makeRecipe('a'))
    store.save(makeRecipe('b'))
    store.save(makeRecipe('c'))
    expect(store.list().map((r) => r.id)).toEqual(['c', 'b', 'a'])
    store.toggleFavorite('a')
    expect(store.list().map((r) => r.id)).toEqual(['a', 'c', 'b'])
    expect(store.get('a')?.favorite).toBe(true)
    store.toggleFavorite('a')
    expect(store.list().map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('削除でそのレシピだけが消える（ほかのキーの中身は残る）', () => {
    const storage = memoryStorage()
    storage.setItem('coffeetimer.records.v1', '{"version":1,"items":[]}')
    const store = createRecipeStore(storage, clock())
    store.save(makeRecipe('a'))
    store.save(makeRecipe('b'))
    store.remove('a')
    expect(store.list().map((r) => r.id)).toEqual(['b'])
    expect(createRecipeStore(memoryStorage(storage.data)).list().map((r) => r.id)).toEqual(['b'])
    expect(storage.getItem('coffeetimer.records.v1')).toBe('{"version":1,"items":[]}')
  })

  it('変更を知らせ、変更が無ければ一覧は同じ配列のまま', () => {
    const store = createRecipeStore(memoryStorage(), clock())
    let calls = 0
    const unsubscribe = store.subscribe(() => calls++)
    const before = store.list()
    expect(store.list()).toBe(before)
    store.save(makeRecipe('a'))
    expect(calls).toBe(1)
    expect(store.list()).not.toBe(before)
    unsubscribe()
    store.remove('a')
    expect(calls).toBe(1)
  })
})

describe('保存先が使えない・壊れているとき', () => {
  it('localStorage が無い（null）ときは空の一覧で、保存は画面の中だけ続く', () => {
    const store = createRecipeStore(null, clock())
    expect(store.list()).toEqual([])
    expect(store.save(makeRecipe('a'))).toBe(false)
    expect(store.list()).toHaveLength(1)
  })

  it('読み書きで例外になる保存先でも止まらず空の一覧', () => {
    const store = createRecipeStore(throwingStorage(), clock())
    expect(store.list()).toEqual([])
    expect(store.save(makeRecipe('a'))).toBe(false)
    expect(store.recoveredFromBroken).toBe(false)
  })

  it('JSON として読めない中身は退避して空で始める', () => {
    const storage = memoryStorage()
    storage.setItem(RECIPES_KEY, '{こわれた')
    const store = createRecipeStore(storage)
    expect(store.list()).toEqual([])
    expect(store.recoveredFromBroken).toBe(true)
    expect(storage.getItem(brokenKey(RECIPES_KEY))).toBe('{こわれた')
    expect(storage.getItem(RECIPES_KEY)).toBeNull()
  })

  it('形が違う中身も退避して空で始め、次に開いたときは知らせない', () => {
    const storage = memoryStorage()
    storage.setItem(RECIPES_KEY, JSON.stringify({ version: 1, items: [{ id: 1 }] }))
    expect(createRecipeStore(storage).recoveredFromBroken).toBe(true)
    const again = createRecipeStore(memoryStorage(storage.data))
    expect(again.recoveredFromBroken).toBe(false)
    expect(storage.getItem(brokenKey(RECIPES_KEY))).not.toBeNull()
  })
})
