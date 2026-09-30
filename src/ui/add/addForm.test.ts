import { describe, expect, it } from 'vitest'
import { resolveTextVideoUrl } from './addForm'

describe('resolveTextVideoUrl（文章と一緒に入れた動画の URL）', () => {
  it('空なら空', () => {
    expect(resolveTextVideoUrl('  ')).toBe('')
  })
  it('YouTube の URL は形をそろえる', () => {
    expect(resolveTextVideoUrl(' https://youtu.be/dQw4w9WgXcQ?si=x ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
  it('そのほかの http・https の URL はそのまま', () => {
    expect(resolveTextVideoUrl('https://example.com/recipe')).toBe('https://example.com/recipe')
  })
  it('URL でなければ null', () => {
    expect(resolveTextVideoUrl('動画です')).toBeNull()
    expect(resolveTextVideoUrl('javascript:alert(1)')).toBeNull()
  })
})
