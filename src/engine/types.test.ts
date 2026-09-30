import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, GRINDS } from './types'

describe('型に付けた定数', () => {
  it('挽き目は5種類（細かい順）', () => {
    expect(GRINDS).toEqual(['極細挽き', '細挽き', '中細挽き', '中挽き', '粗挽き'])
  })
  it('設定の初期値は 音 ON・読み上げ ON', () => {
    expect(DEFAULT_SETTINGS).toEqual({ soundOn: true, speechOn: true })
  })
})
