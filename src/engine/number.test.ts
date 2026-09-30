import { describe, expect, it } from 'vitest'
import { parseDecimal } from './number'

describe('parseDecimal', () => {
  it('整数・小数を読む', () => {
    expect(parseDecimal('15')).toBe(15)
    expect(parseDecimal('15.5')).toBe(15.5)
    expect(parseDecimal(' 250 ')).toBe(250)
    expect(parseDecimal('.5')).toBe(0.5)
    expect(parseDecimal('20.')).toBe(20)
    expect(parseDecimal('0')).toBe(0)
  })
  it('全角の数字・小数点も読む', () => {
    expect(parseDecimal('１５')).toBe(15)
    expect(parseDecimal('１５．５')).toBe(15.5)
  })
  it('空・数でない・負の値・単位つきは null', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('  ')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('-5')).toBeNull()
    expect(parseDecimal('15g')).toBeNull()
    expect(parseDecimal('1.2.3')).toBeNull()
  })
})
