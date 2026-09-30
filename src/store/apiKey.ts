// APIキーの保存（仕様 6.4、architecture.md 3.3）
// ほかのデータ（レシピ・設定）と別のキーに、キーの文字だけを保存する。バックアップ・人に渡すファイルの対象外。
// キーの文字は画面・ログに出さない
import { createEmitter, getBrowserStorage } from './storage'
import type { KeyValueStore } from './storage'

export const API_KEY_STORAGE_KEY = 'coffeetimer.apiKey'

export interface ApiKeyStore {
  subscribe(listener: () => void): () => void
  /** キーがあるか（画面の「設定済み」はこれで出す） */
  has(): boolean
  /** キーを読む（AI を呼ぶときだけ使う）。無ければ null */
  get(): string | null
  /** 入れる（前後の空白を除く）。空なら入れずに false。端末に書けたら true */
  set(key: string): boolean
  /** 消す。端末から消せたら true */
  clear(): boolean
}

export function createApiKeyStore(storage: KeyValueStore | null): ApiKeyStore {
  let current: string | null = null
  try {
    const raw = storage?.getItem(API_KEY_STORAGE_KEY) ?? null
    current = raw !== null && raw.trim() !== '' ? raw.trim() : null
  } catch {
    current = null
  }
  const emitter = createEmitter()
  return {
    subscribe: emitter.subscribe,
    has: () => current !== null,
    get: () => current,
    set(key) {
      const k = key.trim()
      if (k === '') return false
      current = k
      emitter.emit()
      if (!storage) return false
      try {
        storage.setItem(API_KEY_STORAGE_KEY, k)
        return true
      } catch {
        return false
      }
    },
    clear() {
      current = null
      emitter.emit()
      if (!storage) return false
      try {
        storage.removeItem(API_KEY_STORAGE_KEY)
        return true
      } catch {
        return false
      }
    },
  }
}

let instance: ApiKeyStore | null = null

/** アプリで使う APIキーの保存先（ブラウザの localStorage） */
export function apiKeyStore(): ApiKeyStore {
  instance ??= createApiKeyStore(getBrowserStorage())
  return instance
}
