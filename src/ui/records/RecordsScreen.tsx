// 記録タブ：淹れた記録の一覧（仕様 9.2）
// 新しい順。レシピで絞り込める（消したレシピも記録に残した名前で選べる）。タップで直す・削除
import { filterByRecipe, formatBrewedAt, recordRecipeOptions } from '../../engine/record'
import type { BrewRecord, Recipe } from '../../engine/types'
import './records.css'

export interface RecordsScreenProps {
  records: readonly BrewRecord[]
  recipes: readonly Recipe[]
  /** 絞り込み中のレシピの ID（null はすべて） */
  filter: string | null
  onFilterChange: (recipeId: string | null) => void
  onOpen: (id: string) => void
  /** 保存・削除のあとの短い知らせ */
  notice: string | null
  onCloseNotice: () => void
}

function stars(rating: BrewRecord['rating']): string {
  return rating === null ? '' : '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

export function RecordsScreen({
  records,
  recipes,
  filter,
  onFilterChange,
  onOpen,
  notice,
  onCloseNotice,
}: RecordsScreenProps) {
  const options = recordRecipeOptions(records, recipes)
  // 絞り込んでいたレシピの記録が無くなったら、すべてに戻す
  const current = filter !== null && options.some((o) => o.recipeId === filter) ? filter : null
  const shown = filterByRecipe(records, current)
  const deletedIds = new Set(options.filter((o) => o.deleted).map((o) => o.recipeId))
  const nameOf = (r: BrewRecord) => options.find((o) => o.recipeId === r.recipeId)?.name ?? r.recipeName

  return (
    <div className="stack">
      <h1 className="page-title" style={{ margin: 0 }}>
        淹れた記録
      </h1>

      {notice && (
        <div className="notice notice-row" role="status">
          <p>{notice}</p>
          <button type="button" className="btn btn-ghost" aria-label="この知らせを閉じる" onClick={onCloseNotice}>
            ✕
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="card empty">
          <p>まだ淹れた記録がありません。</p>
          <p className="muted">
            レシピのタイマーで淹れ終わると「記録をつける」ボタンが出ます。豆の名前・評価・メモを残すと、ここに新しい順で並びます。
          </p>
        </div>
      ) : (
        <>
          <div className="field">
            <label className="field-label" htmlFor="f-record-filter">
              レシピで絞り込む
            </label>
            <select
              id="f-record-filter"
              className="input"
              value={current ?? ''}
              onChange={(e) => onFilterChange(e.target.value === '' ? null : e.target.value)}
            >
              <option value="">すべてのレシピ（{records.length}件）</option>
              {options.map((o) => (
                <option key={o.recipeId} value={o.recipeId}>
                  {o.name}（{o.deleted ? '削除したレシピ・' : ''}
                  {o.count}件）
                </option>
              ))}
            </select>
          </div>

          <p className="muted small" style={{ margin: 0 }}>
            記録を押すと、直したり削除したりできます。
          </p>

          <ul className="record-list">
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" className="card record-card" onClick={() => onOpen(r.id)}>
                  <span className="record-card-top">
                    <span className="record-date">{formatBrewedAt(r.brewedAt)}</span>
                    {r.rating !== null && (
                      <span className="record-stars" aria-label={`評価 ★${r.rating}`}>
                        {stars(r.rating)}
                      </span>
                    )}
                  </span>
                  <span className="record-name">
                    {nameOf(r)}
                    {deletedIds.has(r.recipeId) && <span className="muted small">（削除したレシピ）</span>}
                  </span>
                  <span className="small">
                    <span className="nowrap">豆 {r.beansG}g</span>・<span className="nowrap">湯量 {r.waterG}g</span>
                  </span>
                  {r.beanName && <span className="record-bean">{r.beanName}</span>}
                  {r.memo && <span className="record-memo-preview muted">{r.memo}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
