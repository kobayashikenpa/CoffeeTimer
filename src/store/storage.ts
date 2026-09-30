// localStorage の安全な読み書き（architecture.md 3.3）
// 読み書きはすべて try/catch で囲み、使えない端末・いっぱいのときでも例外で止まらないようにする

/** localStorage と同じ読み書きができるもの（テストでは差し替える） */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * ブラウザの localStorage。使えない（設定で禁止など）ときは null。
 * 使えるかは「読めるか」で決める。書き込みで試すと、いっぱいのときに使えない扱いになり、
 * 保存してあるデータまで 0 件に見えてしまうため（書けないことは saveJson の false で分かる）
 */
export function getBrowserStorage(): KeyValueStore | null {
  try {
    const s = globalThis.localStorage
    if (!s) return null
    s.getItem('coffeetimer.probe')
    return s
  } catch {
    return null
  }
}

/** 読んだ結果。broken は「中身が壊れていたので退避した」 */
export interface LoadResult<T> {
  value: T | null
  broken: boolean
}

/** 壊れていた中身を退避するキー */
export function brokenKey(key: string): string {
  return `${key}.broken`
}

/**
 * JSON を読み、parse で形を確かめる。
 * 何も保存されていなければ value は null。
 * JSON として読めない・形が違うときは、元の文字列を `<key>.broken` に退避して value は null・broken は true
 */
export function loadJson<T>(store: KeyValueStore | null, key: string, parse: (v: unknown) => T | null): LoadResult<T> {
  if (!store) return { value: null, broken: false }
  let raw: string | null
  try {
    raw = store.getItem(key)
  } catch {
    return { value: null, broken: false }
  }
  if (raw === null) return { value: null, broken: false }
  let value: T | null = null
  try {
    value = parse(JSON.parse(raw))
  } catch {
    value = null
  }
  if (value !== null) return { value, broken: false }
  try {
    store.setItem(brokenKey(key), raw)
    store.removeItem(key)
  } catch {
    // 退避できなくても、元の中身は消さずにそのまま残す（上書きされるまで）
  }
  return { value: null, broken: true }
}

/** JSON を書く。書けたら true（使えない・いっぱいなら false） */
export function saveJson(store: KeyValueStore | null, key: string, value: unknown): boolean {
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** 変更を画面に知らせる仕組み（useSyncExternalStore 用） */
export function createEmitter() {
  const listeners = new Set<() => void>()
  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(): void {
      for (const l of listeners) l()
    },
  }
}
