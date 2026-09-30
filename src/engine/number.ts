// 入力欄の数の読み取り（豆の量・湯量・湯温・目標量）

/** 全角の数字・小数点を半角にする */
function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/．/g, '.')
}

/**
 * 入力された文字を 0 以上の数にする（例 '15'・'15.5'・'１５'・'.5'）。
 * 全角の数字・小数点も読む。空・数でない・負の値は null
 */
export function parseDecimal(text: string): number | null {
  const t = toHalfWidth(text).trim()
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
