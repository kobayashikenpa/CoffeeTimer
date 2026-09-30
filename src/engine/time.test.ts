import { describe, expect, it } from 'vitest'
import { formatTime, parseTime } from './time'

describe('formatTime（秒 → 分:秒）', () => {
  it('90 秒は 1:30', () => {
    expect(formatTime(90)).toBe('1:30')
  })
  it('0 秒は 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })
  it('605 秒は 10:05', () => {
    expect(formatTime(605)).toBe('10:05')
  })
  it('59 秒は 0:59、60 秒は 1:00', () => {
    expect(formatTime(59)).toBe('0:59')
    expect(formatTime(60)).toBe('1:00')
  })
  it('60 分以上もそのまま分で出す（3600 秒は 60:00）', () => {
    expect(formatTime(3600)).toBe('60:00')
  })
  it('小数の秒は切り捨てる', () => {
    expect(formatTime(89.9)).toBe('1:29')
  })
  it('負の値は 0:00 にする', () => {
    expect(formatTime(-3)).toBe('0:00')
  })
})

describe('parseTime（分:秒 または 秒 → 秒）', () => {
  it("'1:30' は 90", () => {
    expect(parseTime('1:30')).toBe(90)
  })
  it("'90' は 90", () => {
    expect(parseTime('90')).toBe(90)
  })
  it("'0' と '0:00' は 0", () => {
    expect(parseTime('0')).toBe(0)
    expect(parseTime('0:00')).toBe(0)
  })
  it("'10:05' は 605、'1:5' は 65", () => {
    expect(parseTime('10:05')).toBe(605)
    expect(parseTime('1:5')).toBe(65)
  })
  it('前後の空白は無視する', () => {
    expect(parseTime(' 1:30 ')).toBe(90)
  })
  it('全角の数字・コロンも読める', () => {
    expect(parseTime('１：３０')).toBe(90)
    expect(parseTime('９０')).toBe(90)
    expect(parseTime('1：30')).toBe(90)
  })
  it('秒が 60 以上の 分:秒 は null', () => {
    expect(parseTime('1:75')).toBeNull()
    expect(parseTime('1:60')).toBeNull()
  })
  it('数字でないもの・空・負の値は null', () => {
    expect(parseTime('abc')).toBeNull()
    expect(parseTime('')).toBeNull()
    expect(parseTime('   ')).toBeNull()
    expect(parseTime('-5')).toBeNull()
    expect(parseTime('-1:30')).toBeNull()
  })
  it('小数・形の崩れたものは null', () => {
    expect(parseTime('1.5')).toBeNull()
    expect(parseTime('1:')).toBeNull()
    expect(parseTime(':30')).toBeNull()
    expect(parseTime('1:2:3')).toBeNull()
    expect(parseTime('1:30a')).toBeNull()
  })
})
