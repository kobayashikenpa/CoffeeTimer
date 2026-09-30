// 秒 ⇄ 分:秒 の変換（仕様 2・7）

/** 秒を「分:秒」の文字にする（例 90 → '1:30'）。小数は切り捨て、負の値は 0 とする */
export function formatTime(sec: number): string {
  const total = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0
  const min = Math.floor(total / 60)
  const s = total % 60
  return `${min}:${String(s).padStart(2, '0')}`
}

/** 全角の数字・コロンを半角にする */
function toHalfWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ':')
}

/**
 * 「分:秒」または「秒」の文字を秒にする（例 '1:30'・'90' → 90）。
 * 全角の数字・コロンも読む。読めないとき（秒が 60 以上の 分:秒、負の値、小数、空など）は null
 */
export function parseTime(text: string): number | null {
  const t = toHalfWidth(text).trim()
  const minSec = /^(\d+):(\d{1,2})$/.exec(t)
  if (minSec) {
    const min = Number(minSec[1])
    const sec = Number(minSec[2])
    if (sec >= 60) return null
    return min * 60 + sec
  }
  if (/^\d+$/.test(t)) return Number(t)
  return null
}
