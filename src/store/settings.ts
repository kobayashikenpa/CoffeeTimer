// 設定（音・読み上げの初期値）の保存（仕様 11）
import { parseStoredSettings } from '../engine/stored'
import { DEFAULT_SETTINGS } from '../engine/types'
import type { Settings } from '../engine/types'
import { createEmitter, getBrowserStorage, loadJson, saveJson } from './storage'
import type { KeyValueStore } from './storage'

export const SETTINGS_KEY = 'coffeetimer.settings.v1'

export interface SettingsStore {
  subscribe(listener: () => void): () => void
  /** 今の設定。変更が無ければ同じオブジェクトを返す */
  get(): Settings
  /** 一部を変えて保存する。端末に書けたら true */
  update(patch: Partial<Settings>): boolean
  /** 全体を置き換える（バックアップの読み込み・その取り消し用）。端末に書けたら true */
  replace(settings: Settings): boolean
  /** 読み込んだとき中身が壊れていて、退避して初期値で始めたか */
  readonly recoveredFromBroken: boolean
}

export function createSettingsStore(storage: KeyValueStore | null): SettingsStore {
  const loaded = loadJson(storage, SETTINGS_KEY, parseStoredSettings)
  let current: Settings = loaded.value ?? { ...DEFAULT_SETTINGS }
  const emitter = createEmitter()
  return {
    subscribe: emitter.subscribe,
    get: () => current,
    update(patch) {
      current = { ...current, ...patch }
      const ok = saveJson(storage, SETTINGS_KEY, current)
      emitter.emit()
      return ok
    },
    replace(settings) {
      current = { soundOn: settings.soundOn, speechOn: settings.speechOn }
      const ok = saveJson(storage, SETTINGS_KEY, current)
      emitter.emit()
      return ok
    },
    recoveredFromBroken: loaded.broken,
  }
}

let instance: SettingsStore | null = null

/** アプリで使う設定の保存先（ブラウザの localStorage） */
export function settingsStore(): SettingsStore {
  instance ??= createSettingsStore(getBrowserStorage())
  return instance
}
