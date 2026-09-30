# CoffeeTimer（コーヒー抽出タイマー）

YouTube のコーヒーレシピ動画を AI（Google Gemini）で読み取り、手順どおりに進むタイマーにする Web アプリ。スマホ（iPhone / Android）で使う。

- **仕様の正は `docs/spec.md`**。実装で迷ったら仕様書に従い、仕様書に書いていないことは勝手に決めずに進行役（メインの Claude）に報告する
- 作業の一覧は `docs/tasks.md`、設計は `docs/architecture.md`
- オーナーが最初に見せた試作（1ファイルの Coffee Timer）は参考のみ。コードは流用せず、仕様書から作り直す

## 利用者について

- 利用者（オーナー）は Git も Claude も初心者。報告は日本語で、専門用語には短い説明を添える
- アプリはオーナー以外の人も使う。画面の文言は、プログラムや AI に詳しくない人にも分かる言葉にする
- コーヒーの言葉を使う：豆、湯量、湯温、挽き目、蒸らし、注湯、抽出、比率（豆:湯）、ドリッパー

## 技術

- React + TypeScript（strict）+ Vite、テストは Vitest、リントは oxlint
- 公開先は GitHub Pages（`https://kobayashikenpa.github.io/CoffeeTimer/`）。`vite.config.ts` の `base` は `/CoffeeTimer/`
- サーバーは持たない。AI（Gemini API）はブラウザから直接呼ぶ。APIキーは利用者が自分で取り、自分の端末のブラウザにだけ保存する
- Node.js / npm は `~/.local/bin` にある場合がある。PATH に無ければ `export PATH="$HOME/.local/bin:$PATH"` を先に実行する

## コマンド

| 目的 | コマンド |
|---|---|
| 全チェック（型・リント・テスト） | `npm run check` |
| テストだけ | `npm test` |
| 開発サーバー | `npm run dev` |
| 本番ビルド | `npm run build` |

## 構成

```
src/
  engine/   ロジック（React に依存しない純粋な TypeScript）
            レシピの型・豆の量による換算・タイマーの進行計算・AI の返答の検証と変換。
            テストは同じ場所に *.test.ts
  ai/       Gemini API の呼び出し（プロンプトと通信）。返答の検証は engine を使う
  ui/       画面（React コンポーネント）
  store/    状態管理と保存（localStorage）、書き出し・読み込み
docs/
  spec.md          仕様書
  architecture.md  設計
  tasks.md         作業の一覧（進捗もここで管理）
  manual.md        取扱説明書（利用者向け。画面が変わるたびに更新）
  glossary.md      画面の用語
```

- `src/engine` は `src/ui`・`src/ai`・`src/store` や React を import しない（ロジックだけでテストできるようにする）
- 重さは g、温度は ℃、時間は秒（整数）で持つ。表示は 分:秒（例 1:30）

## ルール

- 用語・画面の文言は日本語
- ロジックはテストを先に書く。仕様書の例（豆 15g→20g で湯量 250g→333g など）をテストケースに使う
- APIキーは画面・ログ・URL に出さない。通信ではヘッダー（`x-goog-api-key`）で渡す
- AI の返答や動画から来た文字は、HTML として画面に埋め込まない（React の通常の表示にする。`dangerouslySetInnerHTML` は使わない）
- 完了の条件：`npm run check` が通ること。通らないまま「完了」と報告しない
- 1つの作業ごとにコミットする。コミットメッセージは日本語で、何をしたかが分かるように書く
- `main` へ直接コミットしない。ブランチ → PR → オーナーがマージ
- 依存パッケージを増やすときは、理由を報告に書く

## 開発の流れ（ハーネス）

**オーナーの要望を受けたら、コードを書く前に必ず次の順で進める**：
1. 仕様の整理・要件定義・設計（planner と進行役）を行い、仕様書・設計の案としてオーナーに報告する
2. オーナーの許可を得てから、engine-dev / ui-dev にコードを作らせる（許可の前にコードは書かない）

進行役（メインの Claude）が、`.claude/agents/` のサブエージェントに作業を割り振る。

1. **planner**：仕様書から作業を分けて `docs/tasks.md` を更新する
2. **engine-dev**：`src/engine`（と `src/ai`）のロジックをテスト駆動で作る
3. **ui-dev**：`src/ui`・`src/store` のスマホ画面を作る
4. **verifier**：`npm run check` と、仕様書の各項目どおりに動くかを確かめる
5. **reviewer**：差分を仕様書・このファイルのルールと照らしてレビューする
6. **manual-writer**：取扱説明書 `docs/manual.md` を今の画面に合わせて更新する（画面や使い方が変わるPRでは必ず更新する）

進行役は結果をまとめてオーナーに報告し、PR を作る。
