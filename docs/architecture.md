# CoffeeTimer 設計（第1版）

仕様書 `docs/spec.md`（第1版）をもとにした、モジュールの分け方・データの形・処理の流れ。
仕様書で決まっていないため仮に決めたところには **（暫定）** を付ける。暫定の点は `docs/tasks.md` の「未決事項」にも挙げる。

## 1. 全体の考え方

- サーバーは持たない。画面・ロジック・保存はすべてブラウザの中で動き、AI（Gemini API）だけブラウザから直接呼ぶ
- ロジック（`src/engine`）は React にも通信にも保存にも依存しない純粋な TypeScript にし、テストだけで確かめられるようにする
- 「今の時刻」「通信（fetch）」「ID の作り方」は外から渡せる形にして、テストで自由に差し替える

```
            ┌───────────── src/ui（画面・React）─────────────┐
            │  タブ / 一覧 / 追加 / 確認・編集 / タイマー / 記録 / 設定 │
            │  音（Web Audio）・読み上げ・Wake Lock もここ          │
            └──────┬──────────────┬──────────────┬──────────┘
                   │              │              │
             src/store        src/ai          src/engine
         （状態・localStorage  （Gemini 呼び出し）   （ロジック）
           ・書き出し/読み込み）       │              ▲
                   │              └──────────────┤
                   └─────────────────────────────┘
```

import してよい向き：

| モジュール | import してよいもの |
|---|---|
| `src/engine` | なし（標準の TypeScript のみ） |
| `src/ai` | `src/engine` |
| `src/store` | `src/engine` |
| `src/ui` | `src/engine`・`src/ai`・`src/store` |

## 2. モジュール構成

```
src/
  main.tsx                 起動（ルート要素に App を描く）
  engine/
    types.ts               データの型（3章）
    time.ts                秒 ⇄ 分:秒 の変換（formatTime / parseTime）
    recipe.ts              比率・注ぐ量・読み上げ文・手順の並べ替え
    validate.ts            保存するときの確かめ（エラーと注意）
    scale.ts               豆の量による換算
    timer.ts               タイマーの状態と進み具合（実時間から計算）
    cue.ts                 手順の切り替わりで鳴らす合図の判定
    youtube.ts             YouTube の URL の確かめ・形をそろえる
    aiResult.ts            AI の返答の検証と、確認・編集画面の下書きへの変換（単位の直し含む）
    record.ts              淹れた記録の下書き作り・確かめ
    files.ts               人に渡すファイル・バックアップの形の作成と読み取り、足し合わせの計画
    *.test.ts              それぞれのテスト
  ai/
    model.ts               使うモデル名の定数
    prompt.ts              AI への指示文と、返答の形（responseSchema）
    gemini.ts              Gemini API の呼び出し（読み取り・キーの確かめ）とエラーの振り分け
    *.test.ts              差し替えた fetch でのテスト（本物の API は呼ばない）
  store/
    storage.ts             localStorage の安全な読み書き（try/catch）
    recipes.ts             レシピの保存・一覧・お気に入り・削除
    records.ts             淹れた記録の保存・一覧・削除
    settings.ts            設定（音・読み上げの初期値）
    apiKey.ts              APIキー（ほかのデータと別のキーで保存）
    transfer.ts            ファイルの書き出し（共有／保存）と読み込み、バックアップの反映
  ui/
    App.tsx                タブと画面の切り替え
    theme.css              配色（暗い／明るい）と共通の見た目
    tabs/                  下のタブ
    recipes/               レシピ一覧・「⋯」メニュー
    add/                   レシピの追加（URL／文章／ファイル）・読み取り中・エラー表示
    edit/                  確認・編集画面
    timer/                 タイマー画面（輪・今の手順・次の手順・手順の一覧・豆の量）
    records/               記録の一覧・記録の入力
    settings/              設定画面
    device/                音（Web Audio）・読み上げ（speechSynthesis）・Wake Lock
public/
  manifest.webmanifest     ホーム画面に追加したときの名前・アイコン
  icons/                   アイコン（192px・512px・apple-touch-icon 180px）
.github/workflows/
  deploy.yml               main への push で GitHub Pages に公開
```

- 画面の切り替えは、ルーター（URL で画面を切り替える仕組み）の部品を入れず、`App` の状態で切り替える（暫定）
- 状態は各 store が「読む関数・書く関数・変更の通知」を持ち、画面は React の `useSyncExternalStore` でつなぐ（暫定）。状態管理の追加パッケージは使わない

## 3. データの型

重さは g、温度は ℃、時間は秒（整数）。日時は ISO 8601 の文字列（例 `2026-09-30T08:15:00.000Z`）。

```ts
// engine/types.ts

/** 挽き目。未設定は null */
export type Grind = '極細挽き' | '細挽き' | '中細挽き' | '中挽き' | '粗挽き';

/** 手順（仕様 5.2） */
export interface Step {
  /** 開始の時刻（秒）。最初の手順は 0 */
  startSec: number;
  /** 手順名 */
  name: string;
  /** 説明（空文字可） */
  description: string;
  /** 目標量（g、整数（暫定））。注がない手順は null */
  targetG: number | null;
  /** 注意の手順かどうか */
  caution: boolean;
  /** 注意の文（空文字可） */
  cautionText: string;
}

/** レシピ（仕様 5.1）。保存できる状態のもの */
export interface Recipe {
  /** レシピを見分ける ID（crypto.randomUUID で作る（暫定）） */
  id: string;
  name: string;
  author: string;
  videoUrl: string;
  equipment: string;
  /** 豆の量（g、小数第1位まで、0 より大きい） */
  beansG: number;
  /** 湯量（g、0 より大きい整数） */
  waterG: number;
  /** 湯温（℃、整数）。無ければ null */
  tempC: number | null;
  grind: Grind | null;
  description: string;
  /** 完成時刻（秒） */
  totalSec: number;
  /** 開始の時刻の順に並んだ手順（1つ以上） */
  steps: Step[];
  favorite: boolean;
  createdAt: string;
  /** 一覧の並び（新しく追加・編集した順）に使う */
  updatedAt: string;
}

/**
 * 確認・編集画面で使う下書き。AI の読み取り結果・ファイルから受け取ったもの・
 * 既存のレシピを、いったんこの形にしてから画面で直す。
 * 数値は「空」を表せるよう null を許す。
 */
export interface RecipeDraft {
  id: string | null;            // 新しいレシピなら null
  name: string;
  author: string;
  videoUrl: string;
  equipment: string;
  beansG: number | null;
  waterG: number | null;
  tempC: number | null;
  grind: Grind | null;
  description: string;
  totalSec: number | null;
  steps: StepDraft[];
  favorite: boolean;
}
export interface StepDraft {
  startSec: number | null;
  name: string;
  description: string;
  targetG: number | null;
  caution: boolean;
  cautionText: string;
}

/** 保存するときの確かめの結果（仕様 5.3） */
export interface ValidationIssue {
  /** どの項目か。例 'name'、'steps.2.startSec' */
  field: string;
  /** 画面に出す文 */
  message: string;
}
export interface ValidationResult {
  errors: ValidationIssue[];    // 1つでもあれば保存できない
  warnings: ValidationIssue[];  // 保存できるが目立つ注意を出す
}

/** 淹れた記録（仕様 9.1） */
export interface BrewRecord {
  id: string;
  /** 記録の日時（直せる） */
  brewedAt: string;
  /** レシピの ID（レシピを消した後も残す） */
  recipeId: string;
  /** そのときのレシピ名（レシピを消しても名前が残る） */
  recipeName: string;
  beansG: number;
  waterG: number;
  beanName: string;       // 豆の名前・お店（任意）
  rating: 1 | 2 | 3 | 4 | 5 | null;
  memo: string;
  updatedAt: string;
}

/** 設定（仕様 11）。APIキーはここに入れず別に持つ */
export interface Settings {
  soundOn: boolean;   // 初期値 true
  speechOn: boolean;  // 初期値 true
}
```

### 3.1 タイマーの型

```ts
// engine/timer.ts

/** タイマーの状態（仕様 8.3：準備 → 抽出中 ⇄ 一時停止 → 完成） */
export type TimerState =
  | { phase: 'ready'; startAtMs: number }                 // 準備。手順へ飛んだときの開始位置（ふつう 0）
  | { phase: 'running'; anchorMs: number }                // 抽出中。経過 = now − anchorMs
  | { phase: 'paused'; elapsedMs: number }                // 一時停止。止めた時点の経過
  | { phase: 'done' };                                    // 完成

/** 画面に出す進み具合 */
export interface TimerView {
  elapsedSec: number;          // 経過時間（秒、切り捨て）
  progress: number;            // 0〜1（輪の進み具合）
  currentIndex: number | null; // 今の手順（準備中は null）
  nextIndex: number | null;    // 次の手順（無ければ null）
  secondsToNext: number | null;// 次の手順が始まるまでの残り秒数
  done: boolean;
}
```

- 経過時間は「抽出中になった時刻（anchorMs）からの実時間」で出す。1秒ごとに足していく作りにしない
- どの関数も今の時刻 `nowMs` を引数で受け取る（テストで時刻を自由に与えるため）

### 3.2 ファイルの形

```ts
// engine/files.ts

/** 人に渡すファイル（仕様 10.1）。記録・APIキー・お気に入りの印は入れない */
export interface SharedRecipeFile {
  app: 'CoffeeTimer';
  kind: 'recipe';
  version: 1;
  recipe: Omit<Recipe, 'id' | 'favorite' | 'createdAt' | 'updatedAt'>;
}

/** バックアップ（仕様 10.2）。APIキーは入れない */
export interface BackupFile {
  app: 'CoffeeTimer';
  kind: 'backup';
  version: 1;
  exportedAt: string;
  recipes: Recipe[];
  records: BrewRecord[];
  settings: Settings;
}

/** バックアップを足す前に、利用者に示す件数 */
export interface MergePlan {
  recipesAdded: number;
  recipesOverwritten: number;
  recordsAdded: number;
  recordsOverwritten: number;
}
```

- ファイル名は `coffeetimer-recipe-<レシピ名>.json`、`coffeetimer-backup-YYYYMMDD.json`（暫定）
- 「同じレシピ・記録」は ID が同じもの（暫定）

### 3.3 localStorage のキー（暫定）

| キー | 中身 |
|---|---|
| `coffeetimer.recipes.v1` | `{ version: 1, items: Recipe[] }` |
| `coffeetimer.records.v1` | `{ version: 1, items: BrewRecord[] }` |
| `coffeetimer.settings.v1` | `Settings` |
| `coffeetimer.apiKey` | APIキーの文字列だけ。バックアップ・人に渡すファイルの対象外 |

- 読み込んだ中身は engine の関数で形を確かめる。壊れていた場合は、元の文字列を `…​.broken` のキーに退避してから空で始める（暫定）

## 4. 処理の流れ

### 4.1 AI 読み取り（仕様 6）

```
追加画面
 ├ URL を入れる ─ engine/youtube.parseYouTubeUrl で形を確かめる
 │                 形が違う → その場で知らせる（送らない）
 ├ 文章を貼り付ける（URL も入れてよい）
 ↓
store/apiKey にキーが無い → 「AI を使うには APIキーの設定が必要です」＋設定への案内
 ↓
ai/gemini.readRecipe({ input, apiKey, fetch, signal })
 │  POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent
 │  ヘッダー： x-goog-api-key: <キー> / Content-Type: application/json   ※URL にキーを入れない
 │  本文：contents[0].parts =
 │     URL のとき   [{ file_data: { file_uri: <形をそろえた URL> } }, { text: 指示文 }]
 │     文章のとき   [{ text: 指示文 + 貼り付けた文章 }]
 │  generationConfig = { responseMimeType: 'application/json', responseSchema: ai/prompt の形 }
 │  「やめる」→ AbortController で中止
 ↓
返答の振り分け（ai/gemini.classifyError）
 │  通信できない（fetch が失敗）         → network    「インターネットにつながっていないようです」
 │  400 で API_KEY_INVALID／401／403   → invalidKey 「APIキーが正しくないようです…」
 │  429                               → quota      「AI の利用回数の上限に達しました…」
 │  400 などで動画に関するエラー         → video      「この動画は読み取れませんでした…」＋貼り付けへ
 │  JSON として読めない                  → broken     「読み取りに失敗しました…」
 │  中止                               → cancelled  （何も出さず追加画面に戻る）
 ↓
engine/aiResult.normalizeAiResult(unknownJson)
 │  found が false                     → notFound   「この動画からコーヒーのレシピを見つけられませんでした」
 │  形・範囲を確かめ、単位を直す（oz→g、℉→℃、ml→g）
 │  直せない値は null（空）にする。手順は開始の時刻で並べる
 ↓
RecipeDraft（videoUrl を入れる）→ 確認・編集画面（「AI の読み取りは間違えることがあります…」を出す）
```

- モデル名は `ai/model.ts` の定数 `GEMINI_MODEL = 'gemini-2.5-flash'`（暫定）。差し替えはこの1か所だけで済むようにする
- `fetch` は引数で渡す（既定はブラウザの `fetch`）。テストでは偽の fetch を渡し、本物の API は呼ばない
- 「動画を開けない」をどう見分けるか（返ってくるエラーの中身）は実際の返答を見て決める（暫定：400 のうち、キー以外のエラーを video とする）
- AI の返答の形（responseSchema）（暫定）：

```ts
interface AiRecipeResponse {
  found: boolean;                 // コーヒーのレシピが見つかったか
  name: string | null;
  author: string | null;
  equipment: string | null;
  description: string | null;     // 日本語 1〜2文
  beans: { value: number; unit: 'g' | 'oz' } | null;
  water: { value: number; unit: 'g' | 'ml' | 'oz' } | null;
  temperature: { value: number; unit: 'C' | 'F' } | null;
  grind: 'extra_fine' | 'fine' | 'medium_fine' | 'medium' | 'coarse' | null;
  totalSec: number | null;
  steps: {
    startSec: number;
    name: string;                 // 日本語に訳す
    description: string | null;   // 日本語に訳す
    target: { value: number; unit: 'g' | 'ml' | 'oz' } | null;
    caution: string | null;       // 注意の文。あれば注意の手順にする
  }[];
}
```

- 単位は AI に「値と単位」で答えさせ、g・℃ への直しは engine で行う（暫定。計算を AI 任せにしないため）。1 oz = 28.35 g、℃ = (℉ − 32) × 5 ÷ 9、1 ml = 1 g（暫定）
- 返ってきた文字は画面に HTML として埋め込まない（React の通常の表示にする）

### 4.2 APIキーの確かめ（仕様 6.4）

- `ai/gemini.checkApiKey({ apiKey, fetch })`：`GET …/v1beta/models/{MODEL}` をヘッダー `x-goog-api-key` 付きで呼び、200 なら使える（暫定）
- 結果は 使える／正しくない／上限／通信できない のどれかで返す。キーの文字は画面・ログに出さない

### 4.3 換算（仕様 8.2）

```
engine/scale.scaleRecipe(recipe, newBeansG) → ScaledRecipe
  ratio = newBeansG / recipe.beansG は使わず、値ごとに
  新しい値 = Math.round(元の値 × newBeansG ÷ recipe.beansG)
     湯量・各手順の目標量（null はそのまま）
  時間（開始の時刻・完成時刻）は変えない
  注ぐ量は、丸めた後の目標量どうしの差（engine/recipe.pourAmounts を丸めた後の手順に使う）
```

- 例（テストにする）：豆 15g・湯量 250g → 豆 20g で湯量 333g（250 × 20 ÷ 15 = 333.3…）
- `x.5` はちょうど切り上げる（例：目標量 45g・豆 10g → 15g で 67.5 → 68g）。掛けてから割る順にして誤差を小さくする
- 豆の量の入力：− ＋ で 0.5g 刻み、直接入力は小数第1位まで（`engine/scale.normalizeBeans` で丸める）。下限は 0.5g（暫定）
- 換算したものはタイマー画面の中だけで使い、保存しない。「元に戻す」で元の豆の量へ
- 比率は換算後の豆の量・湯量から表示のたびに計算する

### 4.4 タイマー進行（仕様 8.3）

```
engine/timer（すべて nowMs を受け取る純粋な関数）
  initial()                          → { phase:'ready', startAtMs:0 }
  start(state, nowMs)                → ready  → running（anchorMs = nowMs − startAtMs）
  pause(state, nowMs)                → running→ paused（elapsedMs = nowMs − anchorMs）
  resume(state, nowMs)               → paused → running（anchorMs = nowMs − elapsedMs）
  reset()                            → ready（確認なし）
  seek(state, recipe, index, nowMs)  → 手順の開始へ飛ぶ
        running：anchorMs = nowMs − startSec×1000（続けて進む）
        paused ：elapsedMs = startSec×1000（止まったまま）
        ready  ：その位置から抽出中にする（暫定：すぐ進み始める）
  elapsedMs(state, nowMs)            → 経過（完成時刻で頭打ち）
  tick(state, recipe, nowMs)         → 経過が完成時刻に達していれば done にする
  view(state, recipe, nowMs)         → TimerView
```

画面側（`ui/timer`）：

```
START を押す
  → ui/device で音（AudioContext の resume）と読み上げを準備（iPhone 対策。押した操作の中で行う）
  → Wake Lock を取る
  → state = start(state, Date.now())
requestAnimationFrame（または 250ms ごとの setInterval）（暫定）で
  now = Date.now()
  state = tick(state, recipe, now)
  v = view(state, recipe, now)  → 表示
  cue = engine/cue.detectCue(前に合図した手順, v) → あれば音・読み上げ（1回だけ）
visibilitychange で画面に戻ったら、すぐ上の計算をやり直す（実時間に合う）。Wake Lock を取り直す
タイマー画面を離れたら Wake Lock を放す
```

合図（`engine/cue`）：

| 切り替わり | 音 | 読み上げ |
|---|---|---|
| 普通の手順（0秒の手順も START と同時に） | 短い音1回 | `engine/recipe.speechText`（「手順名。目標量グラムまで注いでください。注意の文」） |
| 注意の手順 | 低めの音1回 | 同上 |
| 完成 | 音3回 | 「抽出完了です」 |

- 「前に合図した手順の番号」を覚えておき、番号が変わったときだけ合図を出す（1回だけ）
- 別のアプリから戻ったときなど、手順を2つ以上飛び越えたときは、今の手順の合図だけ出す（暫定）
- 手順へ飛んだときは、飛んだ先の手順の合図を出す（暫定）
- 音の高さ・長さは `ui/device/sound.ts` の定数（暫定：普通 880Hz 0.15秒、注意 440Hz 0.3秒、完成 880Hz×3）
- 音・読み上げの ON／OFF の初期値は設定から取り、タイマー画面での切り替えはその場だけ（設定は変えない）

### 4.5 保存・書き出し（仕様 5.4・9・10）

保存：

```
確認・編集画面「保存」
  → engine/validate.validateRecipe(draft)
       errors あり → 保存しない。field ごとにその項目のそばに出す
       warnings あり → 保存し、目立つ注意を出す
  → engine/validate.toRecipe(draft, { id, nowIso }) で Recipe にする（手順を開始の時刻で並べる）
  → store/recipes.save(recipe)（updatedAt を今にする）→ 一覧へ
一覧の並び：お気に入り → その中は updatedAt の新しい順（engine/recipe.sortForList）
削除：確認 → store/recipes.remove(id)（記録は消さない）
```

淹れた記録：

```
タイマー完成 →「記録をつける」
  → engine/record.createRecordDraft(recipe, 使った豆の量・湯量, nowIso)
  → 入力（豆の名前・お店、★1〜5、メモ、日時を直す）
  → store/records.save(record)
記録タブ：brewedAt の新しい順。recipeId で絞り込み（消したレシピは recipeName で選択肢に出す）
```

人に渡す：

```
「⋯」→「人に渡す」
  → engine/files.toSharedRecipeFile(recipe) → JSON 文字列
  → store/transfer.shareFile(name, json)
       navigator.canShare({ files }) が使える → navigator.share（LINE・メールなど）
       使えない → <a download> でファイルとして保存
受け取る：「＋ レシピを追加」→「ファイルから受け取る」
  → <input type="file" accept=".json,application/json"> で読む
  → engine/files.parseSharedRecipeFile(text) → RecipeDraft（id は null、新しいレシピとして扱う（暫定））
       形が違う → エラーを出して何もしない
  → 確認・編集画面 → 保存
```

バックアップ：

```
書き出す：engine/files.toBackupFile(recipes, records, settings, nowIso) → store/transfer で保存
読み込む：
  → engine/files.parseBackupFile(text)       形が違う・壊れている → エラー、何も変えない
  → engine/files.planMerge(今のデータ, 読んだデータ) → MergePlan（足す件数・上書きする件数）
  → 上書きが1件以上なら件数を示して確認
  → engine/files.applyMerge(...) で足し合わせた結果を作り、store にまとめて書き込む
     （書き込みに失敗したら元に戻す）
  → 設定（音・読み上げ）は読み込んだほうで上書きする（暫定）
```

## 5. 公開・ホーム画面への追加

- `vite.config.ts` の `base` は `/CoffeeTimer/`
- `.github/workflows/deploy.yml`：`main` への push で `npm ci` → `npm run check` → `npm run build` → `dist` を GitHub Pages に公開（`actions/upload-pages-artifact` と `actions/deploy-pages`）。Node は 22
- GitHub のリポジトリ設定で Pages の公開元を「GitHub Actions」にする（オーナーの操作が要る）
- `public/manifest.webmanifest`：`name`・`short_name` は「CoffeeTimer」、`start_url`・`scope` は `/CoffeeTimer/`、`display: standalone`、暗い配色の `theme_color`・`background_color`
- アイコン：192px・512px の PNG と、iPhone 用の `apple-touch-icon`（180px）。`index.html` から読む。絵柄は仮のもの（暫定）
- オフライン対応はしない（仕様 13）ので、Service Worker は入れない

## 6. テストの方針

- `src/engine` はすべて単体テスト。仕様書の例（豆 15g→20g で湯量 250g→333g など）と境界（手順が1つ、豆の量 0 や空、時刻が逆順、AI の返答が壊れている）を入れる
- タイマーは、時刻を数値で与えて「START から 45.2 秒後に一時停止 → 10 秒後に再開 → さらに 5 秒後の経過は 50 秒」のように確かめる
- `src/ai` は偽の fetch で、ヘッダーに `x-goog-api-key` が入り URL にキーが入らないこと、本文に `file_data.file_uri` と `responseSchema` があること、エラーの振り分けを確かめる
- 画面（`src/ui`）は、必要に応じて verifier が実際のブラウザで確かめる（第1版では画面の自動テストは必須にしない（暫定））
