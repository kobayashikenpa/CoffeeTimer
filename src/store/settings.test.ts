import { describe, expect, it } from 'vitest'
import { SETTINGS_KEY, createSettingsStore } from './settings'
import { brokenKey } from './storage'
import { memoryStorage, throwingStorage } from './testStorage'

describe('設定の保存', () => {
  it('初めては音・読み上げとも ON', () => {
    expect(createSettingsStore(memoryStorage()).get()).toEqual({ soundOn: true, speechOn: true })
  })

  it('切り替えて開き直しても保たれる', () => {
    const storage = memoryStorage()
    const store = createSettingsStore(storage)
    expect(store.update({ soundOn: false })).toBe(true)
    expect(store.get()).toEqual({ soundOn: false, speechOn: true })
    store.update({ speechOn: false })

    const reopened = createSettingsStore(memoryStorage(storage.data))
    expect(reopened.get()).toEqual({ soundOn: false, speechOn: false })
  })

  it('変更を知らせる', () => {
    const store = createSettingsStore(memoryStorage())
    let calls = 0
    store.subscribe(() => calls++)
    const before = store.get()
    store.update({ soundOn: false })
    expect(calls).toBe(1)
    expect(store.get()).not.toBe(before)
  })

  it('使えない保存先でも止まらず初期値で動く', () => {
    const store = createSettingsStore(throwingStorage())
    expect(store.get()).toEqual({ soundOn: true, speechOn: true })
    expect(store.update({ soundOn: false })).toBe(false)
    expect(store.get().soundOn).toBe(false)
  })

  it('壊れた中身は退避して初期値で始める', () => {
    const storage = memoryStorage()
    storage.setItem(SETTINGS_KEY, '{"soundOn":"はい"}')
    const store = createSettingsStore(storage)
    expect(store.get()).toEqual({ soundOn: true, speechOn: true })
    expect(store.recoveredFromBroken).toBe(true)
    expect(storage.getItem(brokenKey(SETTINGS_KEY))).toBe('{"soundOn":"はい"}')
  })
})
