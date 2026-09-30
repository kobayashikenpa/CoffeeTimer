import { describe, expect, it } from 'vitest'
import { parseBackupFile, toBackupFile } from '../engine/files'
import type { BrewRecord, Recipe } from '../engine/types'
import { createApiKeyStore } from './apiKey'
import { RECIPES_KEY, createRecipeStore } from './recipes'
import { RECORDS_KEY, createRecordStore } from './records'
import { SETTINGS_KEY, createSettingsStore } from './settings'
import type { KeyValueStore } from './storage'
import { memoryStorage } from './testStorage'
import { backupJson, importBackup, planImport, readFile, shareFile } from './transfer'
import type { ShareEnv, Stores } from './transfer'

// テスト用の仮のキー（本物のキーではない）
const KEY = 'test-key-not-real-456'

function recipe(id: string, over: Partial<Recipe> = {}): Recipe {
  return {
    id,
    name: `レシピ${id}`,
    author: '',
    videoUrl: '',
    equipment: '',
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
    ...over,
  }
}
function record(id: string, over: Partial<BrewRecord> = {}): BrewRecord {
  return {
    id,
    brewedAt: '2026-09-30T08:00:00.000Z',
    recipeId: 'a',
    recipeName: 'レシピa',
    beansG: 15,
    waterG: 250,
    beanName: '',
    rating: null,
    memo: '',
    updatedAt: '2026-09-30T08:00:00.000Z',
    ...over,
  }
}

function makeStores(storage: KeyValueStore): Stores {
  return {
    recipes: createRecipeStore(storage),
    records: createRecordStore(storage),
    settings: createSettingsStore(storage),
  }
}

/** startFailing() の後、指定したキーへの書き込みだけ失敗する保存先 */
function failingOn(key: string, data = new Map<string, string>()) {
  const base = memoryStorage(data)
  let fail = false
  return {
    storage: {
      ...base,
      setItem(k: string, v: string) {
        if (fail && k === key) throw new Error('いっぱいです')
        base.setItem(k, v)
      },
    } as KeyValueStore,
    data,
    startFailing: () => {
      fail = true
    },
  }
}

describe('shareFile', () => {
  const env = (over: Partial<ShareEnv> = {}) => {
    const calls: string[] = []
    const e: ShareEnv = {
      download: (name) => {
        calls.push(`download:${name}`)
      },
      ...over,
    }
    return { e, calls }
  }

  it('ファイルの共有が使えれば共有の画面を開く', async () => {
    let shared: File[] = []
    const { e, calls } = env({
      canShare: () => true,
      share: async (d) => {
        shared = d.files
      },
    })
    expect(await shareFile('a.json', '{"x":1}', e)).toBe('shared')
    expect(shared[0].name).toBe('a.json')
    expect(await shared[0].text()).toBe('{"x":1}')
    expect(calls).toEqual([])
  })

  it('共有が使えない端末では、ファイルとして保存する', async () => {
    const { e, calls } = env()
    expect(await shareFile('a.json', '{}', e)).toBe('downloaded')
    expect(calls).toEqual(['download:a.json'])
    const { e: e2, calls: calls2 } = env({ canShare: () => false, share: async () => {} })
    expect(await shareFile('b.json', '{}', e2)).toBe('downloaded')
    expect(calls2).toEqual(['download:b.json'])
  })

  it('共有の画面を閉じたら何もしない。共有できなかったら保存する', async () => {
    const abort = Object.assign(new Error('やめた'), { name: 'AbortError' })
    const { e, calls } = env({ canShare: () => true, share: () => Promise.reject(abort) })
    expect(await shareFile('a.json', '{}', e)).toBe('cancelled')
    expect(calls).toEqual([])
    const denied = Object.assign(new Error('だめ'), { name: 'NotAllowedError' })
    const { e: e2, calls: calls2 } = env({ canShare: () => true, share: () => Promise.reject(denied) })
    expect(await shareFile('a.json', '{}', e2)).toBe('downloaded')
    expect(calls2).toEqual(['download:a.json'])
  })

  it('保存もできなければ failed', async () => {
    const { e } = env({
      download: () => {
        throw new Error('x')
      },
    })
    expect(await shareFile('a.json', '{}', e)).toBe('failed')
  })
})

describe('readFile', () => {
  it('文字として読む。大きすぎるファイルは読まない', async () => {
    expect(await readFile(new Blob(['{"a":1}']))).toEqual({ ok: true, text: '{"a":1}' })
    expect(await readFile(new Blob(['12345']), 4)).toEqual({ ok: false, reason: 'tooLarge' })
  })
})

describe('バックアップの書き出しと読み込み', () => {
  it('書き出したファイルに APIキーが入らない', () => {
    const storage = memoryStorage()
    createApiKeyStore(storage).set(KEY)
    const stores = makeStores(storage)
    stores.recipes.save(recipe('a'))
    stores.records.save(record('x'))
    const json = backupJson(stores)
    expect(json).not.toContain(KEY)
    expect(json).not.toContain('apiKey')
    expect(parseBackupFile(json).ok).toBe(true)
  })

  it('書き出して、消した後の状態に読み込むと元に戻る（APIキーはそのまま残る）', () => {
    const storage = memoryStorage()
    const stores = makeStores(storage)
    stores.recipes.save(recipe('a', { favorite: true }))
    stores.recipes.save(recipe('b'))
    stores.records.save(record('x', { rating: 5 }))
    stores.settings.update({ soundOn: false })
    const json = backupJson(stores)
    const before = { r: stores.recipes.list(), b: stores.records.list(), s: stores.settings.get() }

    // すべて消した端末
    const fresh = memoryStorage()
    createApiKeyStore(fresh).set(KEY)
    const freshStores = makeStores(fresh)
    const parsed = parseBackupFile(json)
    if (!parsed.ok) throw new Error('読めない')
    expect(planImport(parsed.backup, freshStores)).toEqual({
      recipesAdded: 2,
      recipesOverwritten: 0,
      recordsAdded: 1,
      recordsOverwritten: 0,
    })
    expect(importBackup(parsed.backup, freshStores)).toBe(true)
    const reopened = makeStores(memoryStorage(fresh.data))
    expect(reopened.recipes.list()).toEqual(before.r)
    expect(reopened.records.list()).toEqual(before.b)
    expect(reopened.settings.get()).toEqual(before.s)
    expect(createApiKeyStore(memoryStorage(fresh.data)).get()).toBe(KEY)
  })

  it('同じ ID は上書きし、新しいものは足す', () => {
    const stores = makeStores(memoryStorage())
    stores.recipes.save(recipe('a'))
    stores.records.save(record('x'))
    const backup = toBackupFile([recipe('a', { name: '上書き' }), recipe('c')], [record('y')], { soundOn: true, speechOn: false }, '2026-09-30T00:00:00.000Z')
    expect(planImport(backup, stores)).toEqual({ recipesAdded: 1, recipesOverwritten: 1, recordsAdded: 1, recordsOverwritten: 0 })
    expect(importBackup(backup, stores)).toBe(true)
    expect(stores.recipes.get('a')?.name).toBe('上書き')
    expect(stores.recipes.list()).toHaveLength(2)
    expect(stores.records.list()).toHaveLength(2)
    expect(stores.settings.get()).toEqual({ soundOn: true, speechOn: false })
  })

  for (const failKey of [RECIPES_KEY, RECORDS_KEY, SETTINGS_KEY]) {
    it(`書き込みの途中（${failKey}）で失敗したら、元のデータに戻す`, () => {
      const f = failingOn(failKey)
      const stores = makeStores(f.storage)
      stores.recipes.save(recipe('a'))
      stores.records.save(record('x'))
      stores.settings.update({ speechOn: false })
      const snapshot = new Map(f.data)
      const backup = toBackupFile([recipe('a', { name: '上書き' }), recipe('b')], [record('y')], { soundOn: false, speechOn: true }, '2026-09-30T00:00:00.000Z')

      f.startFailing()
      expect(importBackup(backup, stores)).toBe(false)
      // 端末に保存した中身も、画面が使う中身も元のまま
      expect(f.data).toEqual(snapshot)
      expect(stores.recipes.list().map((r) => [r.id, r.name])).toEqual([['a', 'レシピa']])
      expect(stores.records.list().map((r) => r.id)).toEqual(['x'])
      expect(stores.settings.get()).toEqual({ soundOn: true, speechOn: false })
    })
  }
})
