import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBrowserStorage, saveJson } from './storage'
import { memoryStorage } from './testStorage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getBrowserStorage（使えるかどうかは、読めるかで決める）', () => {
  it('読み書きできる localStorage はそのまま使う', () => {
    const s = memoryStorage()
    vi.stubGlobal('localStorage', s)
    expect(getBrowserStorage()).toBe(s)
  })

  it('いっぱいで書けなくても、読めれば使う（保存したデータを 0 件に見せない）', () => {
    const data = new Map([['coffeetimer.recipes', '{"version":1,"items":[]}']])
    const full = {
      ...memoryStorage(data),
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    vi.stubGlobal('localStorage', full)
    const s = getBrowserStorage()
    expect(s).toBe(full)
    expect(s?.getItem('coffeetimer.recipes')).toBe('{"version":1,"items":[]}')
    // 書けないことは saveJson の false で分かる
    expect(saveJson(s, 'coffeetimer.recipes', { version: 1, items: [] })).toBe(false)
  })

  it('読むと例外になる（使えない）ときは null', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
      removeItem: () => {},
    })
    expect(getBrowserStorage()).toBeNull()
  })

  it('localStorage が無いときは null', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(getBrowserStorage()).toBeNull()
  })

  it('localStorage にさわるだけで例外になるときも null', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      expect(getBrowserStorage()).toBeNull()
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })
})
