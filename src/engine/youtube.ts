// YouTube の URL の確かめ・形をそろえる（仕様 6.1）

/** 動画の ID（YouTube は 11 文字の英数字と - _） */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be'])

export interface YouTubeUrl {
  /** 形をそろえた URL（https://www.youtube.com/watch?v=<ID>） */
  url: string
  videoId: string
}

/**
 * 利用者が入れた文字を YouTube の動画の URL として読む。
 * 受け付ける形：youtube.com/watch?v=…、youtu.be/…、youtube.com/shorts/…、m.youtube.com/…
 * （http／https、www. の有無、「https://」の省略、余分なパラメータ、前後の空白は構わない）。
 * YouTube 以外・動画の ID が無い・ただの文字は null
 */
export function parseYouTubeUrl(text: string): YouTubeUrl | null {
  const t = text.trim()
  if (t === '' || /\s/.test(t)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  let u: URL
  try {
    u = new URL(withScheme)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username !== '' || u.password !== '' || u.port !== '') return null
  const host = u.hostname.toLowerCase()
  const path = u.pathname.replace(/\/+$/, '')

  let id: string | null = null
  if (SHORT_HOSTS.has(host)) {
    const m = /^\/([^/]+)$/.exec(path)
    id = m ? m[1] : null
  } else if (WATCH_HOSTS.has(host)) {
    if (path === '/watch') {
      id = u.searchParams.get('v')
    } else {
      const m = /^\/shorts\/([^/]+)$/.exec(path)
      id = m ? m[1] : null
    }
  }
  if (id === null || !VIDEO_ID.test(id)) return null
  return { url: `https://www.youtube.com/watch?v=${id}`, videoId: id }
}
