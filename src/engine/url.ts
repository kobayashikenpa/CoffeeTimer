// 画面から開いてよい URL か（動画を開く ボタン）

/**
 * http・https の URL なら形をそろえた文字を返す。空・URL でない・ほかの種類（javascript: など）は null。
 * 利用者や AI が入れた文字を、そのままリンクにしないための確かめ
 */
export function openableUrl(text: string): string | null {
  const t = text.trim()
  if (t === '') return null
  try {
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}
