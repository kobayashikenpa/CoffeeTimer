// 淹れた記録の保存・一覧・削除（仕様 9、architecture.md 4.5）
// レシピを消しても記録は消さない（記録にレシピ名を一緒に残している）
import { sortRecords } from '../engine/record'
import { parseStoredRecords } from '../engine/stored'
import type { BrewRecord } from '../engine/types'
import { createEmitter, getBrowserStorage, loadJson, saveJson } from './storage'
import type { KeyValueStore } from './storage'

export const RECORDS_KEY = 'coffeetimer.records.v1'

export interface RecordStore {
  /** 変更の通知を受ける（useSyncExternalStore 用） */
  subscribe(listener: () => void): () => void
  /** 一覧（新しい順）。変更が無ければ同じ配列を返す */
  list(): readonly BrewRecord[]
  /** 1件を読む。無ければ undefined */
  get(id: string): BrewRecord | undefined
  /** 保存（同じ ID があれば置き換え）。updatedAt を今にする。端末に書けたら true */
  save(record: BrewRecord): boolean
  /** 削除。端末に書けたら true */
  remove(id: string): boolean
  /** 全体を置き換える（バックアップの読み込み・その取り消し用）。updatedAt は変えない。端末に書けたら true */
  replaceAll(records: readonly BrewRecord[]): boolean
  /** 読み込んだとき中身が壊れていて、退避して空で始めたか */
  readonly recoveredFromBroken: boolean
}

export function createRecordStore(storage: KeyValueStore | null, now: () => Date = () => new Date()): RecordStore {
  const loaded = loadJson(storage, RECORDS_KEY, parseStoredRecords)
  let items: BrewRecord[] = loaded.value ?? []
  let sorted: readonly BrewRecord[] = sortRecords(items)
  const emitter = createEmitter()

  function commit(next: BrewRecord[]): boolean {
    items = next
    sorted = sortRecords(items)
    const ok = saveJson(storage, RECORDS_KEY, { version: 1, items })
    emitter.emit()
    return ok
  }

  return {
    subscribe: emitter.subscribe,
    list: () => sorted,
    get: (id) => items.find((r) => r.id === id),
    save(record) {
      const saved: BrewRecord = { ...record, updatedAt: now().toISOString() }
      const exists = items.some((r) => r.id === record.id)
      return commit(exists ? items.map((r) => (r.id === record.id ? saved : r)) : [...items, saved])
    },
    remove(id) {
      if (!items.some((r) => r.id === id)) return true
      return commit(items.filter((r) => r.id !== id))
    },
    replaceAll(records) {
      return commit([...records])
    },
    recoveredFromBroken: loaded.broken,
  }
}

let instance: RecordStore | null = null

/** アプリで使う淹れた記録の保存先（ブラウザの localStorage） */
export function recordStore(): RecordStore {
  instance ??= createRecordStore(getBrowserStorage())
  return instance
}
