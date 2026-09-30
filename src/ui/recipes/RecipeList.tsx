// レシピ一覧（仕様 5.4）
import { useState } from 'react'
import { ratio } from '../../engine/recipe'
import { formatTime } from '../../engine/time'
import type { Recipe } from '../../engine/types'
import { ConfirmDialog } from '../common/ConfirmDialog'
import './recipes.css'

export interface RecipeListProps {
  recipes: readonly Recipe[]
  onAdd: () => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onToggleFavorite: (id: string) => void
  /** 「人に渡す」：ファイルにして共有機能で送る */
  onShare: (id: string) => void
  onDelete: (id: string) => void
}

export function RecipeList({ recipes, onAdd, onOpen, onEdit, onToggleFavorite, onShare, onDelete }: RecipeListProps) {
  const [menuFor, setMenuFor] = useState<Recipe | null>(null)
  const [deleting, setDeleting] = useState<Recipe | null>(null)

  return (
    <div className="stack">
      <div className="list-head">
        <h1 className="page-title" style={{ margin: 0 }}>
          レシピ
        </h1>
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          ＋ レシピを追加
        </button>
      </div>

      {recipes.length === 0 && (
        <div className="card empty">
          <p>まだレシピがありません。</p>
          <p className="muted">
            上の「＋
            レシピを追加」を押して、最初のレシピを作りましょう。YouTube の動画の URL から AI で読み取るか、人から渡されたファイルを読み込むか、豆の量・湯量と手順を手で入れると、タイマーで淹れられます。
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={onAdd}>
            ＋ レシピを追加
          </button>
        </div>
      )}

      <ul className="recipe-list">
        {recipes.map((r) => (
          <li key={r.id} className="card recipe-card">
            <button type="button" className="recipe-open" onClick={() => onOpen(r.id)}>
              <span className="recipe-name">{r.name}</span>
              {r.equipment && <span className="muted small">{r.equipment}</span>}
              <span className="recipe-meta">
                <span className="nowrap">豆 {r.beansG}g</span>・<span className="nowrap">湯量 {r.waterG}g</span>・
                <span className="nowrap">比率 {ratio(r.beansG, r.waterG)}</span>
              </span>
              <span className="recipe-meta">抽出時間 {formatTime(r.totalSec)}</span>
            </button>
            <div className="recipe-actions">
              <button
                type="button"
                className={`btn btn-ghost fav${r.favorite ? ' fav-on' : ''}`}
                aria-pressed={r.favorite}
                aria-label={r.favorite ? `「${r.name}」をお気に入りから外す` : `「${r.name}」をお気に入りにする`}
                onClick={() => onToggleFavorite(r.id)}
              >
                {r.favorite ? '★' : '☆'}
              </button>
              <button
                type="button"
                className="btn btn-ghost more"
                aria-label={`「${r.name}」のメニュー`}
                aria-haspopup="dialog"
                onClick={() => setMenuFor(r)}
              >
                ⋯
              </button>
            </div>
          </li>
        ))}
      </ul>

      {menuFor && (
        <div className="overlay" onClick={() => setMenuFor(null)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="menu-title" className="dialog-title">
              {menuFor.name}
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-block"
                onClick={() => {
                  setMenuFor(null)
                  onEdit(menuFor.id)
                }}
              >
                編集
              </button>
              <button
                type="button"
                className="btn btn-block"
                onClick={() => {
                  setMenuFor(null)
                  // iPhone で共有の画面が開くよう、押した操作の中ですぐ呼ぶ
                  onShare(menuFor.id)
                }}
              >
                人に渡す
              </button>
              <button
                type="button"
                className="btn btn-block btn-danger"
                onClick={() => {
                  setDeleting(menuFor)
                  setMenuFor(null)
                }}
              >
                削除
              </button>
              <button type="button" className="btn btn-block" onClick={() => setMenuFor(null)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={`「${deleting.name}」を削除しますか？`}
          message="削除したレシピは元に戻せません。このレシピで淹れた記録は消えずに残ります。"
          confirmLabel="削除する"
          danger
          onConfirm={() => {
            onDelete(deleting.id)
            setDeleting(null)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
