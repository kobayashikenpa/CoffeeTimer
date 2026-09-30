import { describe, expect, it } from 'vitest'
import { parseYouTubeUrl } from './youtube'

const ID = 'dQw4w9WgXcQ'
const WATCH = `https://www.youtube.com/watch?v=${ID}`

describe('parseYouTubeUrl（YouTube の URL の確かめ）', () => {
  it('youtube.com/watch?v=… を受け付け、形をそろえる', () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}`)).toEqual({ url: WATCH, videoId: ID })
    expect(parseYouTubeUrl(`https://youtube.com/watch?v=${ID}`)).toEqual({ url: WATCH, videoId: ID })
    expect(parseYouTubeUrl(`http://www.youtube.com/watch?v=${ID}`)).toEqual({ url: WATCH, videoId: ID })
  })

  it('youtu.be/… を受け付ける', () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}`)).toEqual({ url: WATCH, videoId: ID })
    expect(parseYouTubeUrl(`http://youtu.be/${ID}?si=abcdef&t=30`)).toEqual({ url: WATCH, videoId: ID })
  })

  it('youtube.com/shorts/… を受け付ける', () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/shorts/${ID}`)).toEqual({ url: WATCH, videoId: ID })
    expect(parseYouTubeUrl(`https://youtube.com/shorts/${ID}?feature=share`)).toEqual({ url: WATCH, videoId: ID })
  })

  it('m.youtube.com/watch?v=… を受け付ける', () => {
    expect(parseYouTubeUrl(`https://m.youtube.com/watch?v=${ID}`)).toEqual({ url: WATCH, videoId: ID })
    expect(parseYouTubeUrl(`https://m.youtube.com/shorts/${ID}`)).toEqual({ url: WATCH, videoId: ID })
  })

  it('余分なパラメータ・前後の空白・「https://」の無い形も受け付ける', () => {
    expect(parseYouTubeUrl(`  https://www.youtube.com/watch?feature=share&v=${ID}&t=42s&list=PL123  `)).toEqual({
      url: WATCH,
      videoId: ID,
    })
    expect(parseYouTubeUrl(`\nyoutube.com/watch?v=${ID}\t`)).toEqual({ url: WATCH, videoId: ID })
    expect(parseYouTubeUrl(`www.youtube.com/watch?v=${ID}`)).toEqual({ url: WATCH, videoId: ID })
    expect(parseYouTubeUrl(`youtu.be/${ID}`)).toEqual({ url: WATCH, videoId: ID })
    expect(parseYouTubeUrl(`HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`)).toEqual({ url: WATCH, videoId: ID })
    expect(parseYouTubeUrl(`https://www.youtube.com/watch/?v=${ID}#comments`)).toEqual({ url: WATCH, videoId: ID })
  })

  it('YouTube 以外の URL は null', () => {
    expect(parseYouTubeUrl(`https://example.com/watch?v=${ID}`)).toBeNull()
    expect(parseYouTubeUrl(`https://youtube.com.evil.example/watch?v=${ID}`)).toBeNull()
    expect(parseYouTubeUrl(`https://notyoutube.com/watch?v=${ID}`)).toBeNull()
    expect(parseYouTubeUrl(`https://vimeo.com/${ID}`)).toBeNull()
    expect(parseYouTubeUrl(`ftp://www.youtube.com/watch?v=${ID}`)).toBeNull()
    expect(parseYouTubeUrl(`javascript:alert(1)//youtube.com/watch?v=${ID}`)).toBeNull()
  })

  it('ID の無い URL・形の違う ID は null', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/watch')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=')).toBeNull()
    expect(parseYouTubeUrl('https://youtu.be/')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/shorts/')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ<script>')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/channel/UC1234567890')).toBeNull()
    expect(parseYouTubeUrl(`https://youtu.be/${ID}/extra`)).toBeNull()
  })

  it('ただの文字・空は null', () => {
    expect(parseYouTubeUrl('')).toBeNull()
    expect(parseYouTubeUrl('   ')).toBeNull()
    expect(parseYouTubeUrl('コーヒーの淹れ方')).toBeNull()
    expect(parseYouTubeUrl(ID)).toBeNull()
    expect(parseYouTubeUrl(`見てね https://youtu.be/${ID}`)).toBeNull()
  })
})
