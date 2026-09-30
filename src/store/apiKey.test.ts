import { describe, expect, it } from 'vitest'
import { API_KEY_STORAGE_KEY, createApiKeyStore } from './apiKey'
import { RECIPES_KEY } from './recipes'
import { SETTINGS_KEY } from './settings'
import { memoryStorage, throwingStorage } from './testStorage'

// テスト用の仮のキー（本物のキーではない）
const KEY = 'test-key-not-real-123'

describe('APIキーの保存', () => {
  it('初めは無い', () => {
    const store = createApiKeyStore(memoryStorage())
    expect(store.has()).toBe(false)
    expect(store.get()).toBeNull()
  })

  it('入れて読み直せる（前後の空白は除く）。開き直しても残る', () => {
    const storage = memoryStorage()
    const store = createApiKeyStore(storage)
    expect(store.set(`  ${KEY}\n`)).toBe(true)
    expect(store.has()).toBe(true)
    expect(store.get()).toBe(KEY)
    expect(createApiKeyStore(memoryStorage(storage.data)).get()).toBe(KEY)
  })

  it('消すと無くなる', () => {
    const storage = memoryStorage()
    const store = createApiKeyStore(storage)
    store.set(KEY)
    expect(store.clear()).toBe(true)
    expect(store.has()).toBe(false)
    expect(store.get()).toBeNull()
    expect(storage.data.size).toBe(0)
  })

  it('空白だけのキーは入れない', () => {
    const store = createApiKeyStore(memoryStorage())
    expect(store.set('   ')).toBe(false)
    expect(store.has()).toBe(false)
  })

  it('レシピ・設定の保存と別のキーに、キーの文字だけを保存する', () => {
    expect(API_KEY_STORAGE_KEY).toBe('coffeetimer.apiKey')
    expect(API_KEY_STORAGE_KEY).not.toBe(RECIPES_KEY)
    expect(API_KEY_STORAGE_KEY).not.toBe(SETTINGS_KEY)
    const storage = memoryStorage()
    createApiKeyStore(storage).set(KEY)
    expect([...storage.data.keys()]).toEqual([API_KEY_STORAGE_KEY])
    expect(storage.data.get(API_KEY_STORAGE_KEY)).toBe(KEY)
  })

  it('変更を知らせる', () => {
    const store = createApiKeyStore(memoryStorage())
    let calls = 0
    store.subscribe(() => calls++)
    store.set(KEY)
    store.clear()
    expect(calls).toBe(2)
  })

  it('使えない保存先でも止まらない（その間だけ使える）', () => {
    const store = createApiKeyStore(throwingStorage())
    expect(store.get()).toBeNull()
    expect(store.set(KEY)).toBe(false)
    expect(store.get()).toBe(KEY)
    expect(store.clear()).toBe(false)
    expect(store.has()).toBe(false)
  })
})
