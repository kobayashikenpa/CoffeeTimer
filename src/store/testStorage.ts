// テスト用の localStorage の代わり（画面では使わない）
import type { KeyValueStore } from './storage'

/** 中身を Map に持つ保存先。data を渡すと、ページを開き直した想定で同じ中身から始められる */
export function memoryStorage(data: Map<string, string> = new Map()): KeyValueStore & { data: Map<string, string> } {
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v)
    },
    removeItem: (k) => {
      data.delete(k)
    },
  }
}

/** どの読み書きでも例外になる保存先（使えない端末の想定） */
export function throwingStorage(): KeyValueStore {
  const fail = () => {
    throw new Error('使えません')
  }
  return { getItem: fail, setItem: fail, removeItem: fail }
}
