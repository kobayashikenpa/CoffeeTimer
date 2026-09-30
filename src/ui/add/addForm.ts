// レシピの追加画面の入力（URL・文章）
import { openableUrl } from '../../engine/url'
import { parseYouTubeUrl } from '../../engine/youtube'

export type AddMode = 'url' | 'text'

/** 追加画面の入力。画面を行き来しても消えないよう App が持つ */
export interface AddForm {
  mode: AddMode
  /** YouTube の URL */
  url: string
  /** 貼り付けた文章 */
  text: string
  /** 文章と一緒に入れる動画の URL（任意） */
  textUrl: string
}

export function emptyAddForm(): AddForm {
  return { mode: 'url', url: '', text: '', textUrl: '' }
}

/**
 * 文章と一緒に入れた動画の URL を、保存する形にする。
 * 空なら ''、YouTube の URL なら形をそろえたもの、そのほかの http・https の URL はそのまま、
 * URL として読めなければ null（入れ直してもらう）
 */
export function resolveTextVideoUrl(text: string): string | null {
  if (text.trim() === '') return ''
  const yt = parseYouTubeUrl(text)
  if (yt) return yt.url
  return openableUrl(text)
}
