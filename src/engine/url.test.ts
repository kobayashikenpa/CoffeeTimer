import { describe, expect, it } from 'vitest'
import { openableUrl } from './url'

describe('openableUrl', () => {
  it('http・https の URL は開ける', () => {
    expect(openableUrl('https://www.youtube.com/watch?v=abc')).toBe('https://www.youtube.com/watch?v=abc')
    expect(openableUrl(' https://youtu.be/abc ')).toBe('https://youtu.be/abc')
    expect(openableUrl('http://example.com')).toBe('http://example.com/')
  })
  it('空・URL でない・javascript: などは開かない', () => {
    expect(openableUrl('')).toBeNull()
    expect(openableUrl('youtube.com/watch?v=abc')).toBeNull()
    expect(openableUrl('javascript:alert(1)')).toBeNull()
    expect(openableUrl('data:text/html,hi')).toBeNull()
  })
})
