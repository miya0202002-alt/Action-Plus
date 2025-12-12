# 🚀 Supabase + Clerk 統合プロンプト集

このディレクトリには、Next.js App Router プロジェクトに Supabase と Clerk を統合するためのベストプラクティスとプロンプトが含まれています。

## 📁 ファイル構成

### ベストプラクティスファイル（公式ガイドライン）

1. **`clerk_setupprpompt.md`**
   - Clerk の Next.js App Router への統合ベストプラクティス
   - 最新の `clerkMiddleware()` パターン
   - 非推奨パターンの回避方法

2. **`supabase_bootstrap_nextjs_app_with_SupabaseAuth.md`**
   - Supabase Auth SSR の実装ガイド
   - `@supabase/ssr` の正しい使用方法
   - Cookie ハンドリングのベストプラクティス

3. **`supabase_migration_prompt.md`**
   - データベースマイグレーションファイル作成のガイドライン
   - ファイル命名規則
   - RLS ポリシーの実装パターン

4. **`supabase_postgres_SQL_Style_guide.md`**
   - PostgreSQL SQL のスタイルガイド
   - 命名規則（snake_case、複数形など）
   - クエリフォーマット

5. **`supabase_realtime_AIprompt.md`**
   - Supabase Realtime の実装ガイド
   - `broadcast` vs `postgres_changes`
   - スケーラビリティベストプラクティス

### マスタープロンプト

**`MASTER_INTEGRATION_PROMPT.md`** - 統合自動化プロンプト
- すべてのベストプラクティスを統合
- AI自動実行フェーズとユーザー手動実行フェーズに分離
- プロジェクト設計ドキュメントを自動解析
- 完全な実装を自動生成

**`FRONTEND_IMPLEMENTATION_ADDON.md`** - フロントエンド実装アドオン
- 既存のReact/Next.jsフロントエンドに認証UIを統合
- Server Actions によるデータ操作実装
- Protected routes（認証が必要なページ）の実装
- カスタムフック、ローディング・エラーUI
- Service Role による Clerk ↔ Supabase 自動同期
- リアルタイム機能のUI実装（必要な場合）

---

## 🎯 使い方

### 方法 1: マスタープロンプト + フロントエンド実装（最も推奨）

新しいプロジェクトで Supabase + Clerk を一括セットアップし、認証UIも実装する場合：

1. **プロジェクト設計を準備**
   - `/docs/` フォルダに設計ドキュメントを配置
   - 必要なファイル例：
     - `system_architecture.md`
     - `database_design.md`
     - `requirements.yaml`

2. **AIアシスタント（Cursor/Claude）に指示**
   ```
   以下のファイルをすべて読み込んでください：
   @supabase_prompt/clerk_setupprpompt.md
   @supabase_prompt/supabase_bootstrap_nextjs_app_with_SupabaseAuth.md
   @supabase_prompt/supabase_migration_prompt.md
   @supabase_prompt/supabase_postgres_SQL_Style_guide.md
   @supabase_prompt/supabase_realtime_AIprompt.md
   @supabase_prompt/FRONTEND_IMPLEMENTATION_ADDON.md
   
   次に、@supabase_prompt/MASTER_INTEGRATION_PROMPT.md の内容に従って、
   フロントエンド実装を含めてプロジェクトに Supabase と Clerk を完全に統合してください。
   設計ドキュメントは /docs/ フォルダにあります。
   ```

3. **AIが自動実行**
   - パッケージインストール
   - ファイル生成（middleware、クライアント、マイグレーションなど）
   - 型定義の作成
   - ユーティリティ関数の実装
   - **認証ページの実装**
   - **Protected routes の実装**
   - **ナビゲーションの実装**
   - **Server Actions の実装**
   - **UI コンポーネントの実装**
   - **Service Role ユーティリティの実装**

4. **ユーザーが手動で実行**
   - AIが生成した詳細な指示に従う
   - Clerk Dashboard で設定
   - Supabase Dashboard で設定（service role キーを取得）
   - 環境変数の設定
   - Protected Layout などで `ensureSupabaseUser()` が実行されることを確認

### 方法 2: 個別のベストプラクティスを使用

特定の機能のみを実装する場合：

#### Clerk のみを統合
```
@supabase_prompt/clerk_setupprpompt.md を読み込んで、
このプロジェクトに Clerk を統合してください。
```

#### Supabase のみを統合
```
@supabase_prompt/supabase_bootstrap_nextjs_app_with_SupabaseAuth.md を読み込んで、
このプロジェクトに Supabase Auth を統合してください。
```

#### データベースマイグレーション作成
```
@supabase_prompt/supabase_migration_prompt.md と
@supabase_prompt/supabase_postgres_SQL_Style_guide.md を読み込んで、
以下のテーブル構造に基づいてマイグレーションファイルを作成してください：
[テーブル構造を記述]
```

#### Realtime 機能の追加
```
@supabase_prompt/supabase_realtime_AIprompt.md を読み込んで、
[テーブル名] にリアルタイム更新機能を実装してください。
```

---

## 📖 各ファイルの主要ポイント

### Clerk 統合の重要ポイント

✅ **必ず使用すべきパターン：**
- `clerkMiddleware()` from `@clerk/nextjs/server`
- `<ClerkProvider>` でアプリをラップ
- App Router 構造（`app/layout.tsx`）

❌ **絶対に避けるべきパターン：**
- `authMiddleware()` （非推奨）
- Pages Router パターン（`_app.tsx`）
- 古い環境変数パターン

### Supabase 統合の重要ポイント

✅ **必ず使用すべきパターン：**
- `@supabase/ssr` パッケージ
- `getAll()` と `setAll()` メソッド
- `createBrowserClient` / `createServerClient`

❌ **絶対に避けるべきパターン：**
- `get`、`set`、`remove` メソッド
- `@supabase/auth-helpers-nextjs` （非推奨）
- 個別の Cookie 操作

### データベース設計の重要ポイント

✅ **必ず守るべきルール：**
- すべてのテーブルで RLS を有効化
- 小文字の SQL、snake_case
- テーブル名は複数形、カラム名は単数形
- 各操作（SELECT/INSERT/UPDATE/DELETE）にポリシー作成

### Realtime の重要ポイント

✅ **推奨パターン：**
- `broadcast` を使用（`postgres_changes` ではない）
- 専用トピックを使用（`room:123:messages`）
- `private: true` で RLS を適用

❌ **避けるべきパターン：**
- `postgres_changes`（スケーラビリティの問題）
- 広範なトピック（`global:notifications`）
- 公開チャンネルの多用

### フロントエンド実装の重要ポイント

✅ **実装すべき要素：**
- サインイン/サインアップページ（Clerk UI コンポーネント）
- Protected routes（Server/Client Component 両方）
- ナビゲーション（認証状態による表示切替）
- Server Actions（CRUD 操作 + バリデーション）
- カスタムフック（`useSupabaseUser` など）
- ローディング・エラー UI
- Service Role ベースの Clerk ↔ Supabase 同期（`ensureSupabaseUser`）

✅ **ベストプラクティス：**
- Server Actions で `revalidatePath()` を使用
- `useTransition` でローディング状態を管理
- zod でバリデーション実装
- エラーメッセージをユーザーフレンドリーに
- レスポンシブデザイン対応

❌ **避けるべきパターン：**
- クライアント側でのみ認証チェック（SSR も必要）
- バリデーションなしのフォーム送信
- エラーハンドリングの欠如
- Service Role Key のクライアント側での使用
- Service Role を import したモジュールを Client Component で利用

---

## 🔧 トラブルシューティング

### 問題：AIが古いパターンを提案する

**解決策：**
```
注意：必ず最新のベストプラクティスに従ってください。
- Clerk は clerkMiddleware() を使用
- Supabase は @supabase/ssr と getAll()/setAll() を使用
- authMiddleware や auth-helpers-nextjs は使用しないでください
```

### 問題：設計ドキュメントが見つからない

**解決策：**
```
/docs/ フォルダに以下のファイルを作成してください：
- system_architecture.md: システム全体の設計
- database_design.md: データベーススキーマ
または、最低限のテーブル構造を教えてください。
```

### 問題：マイグレーションエラー

**解決策：**
1. Supabase Dashboard の SQL Editor でエラーメッセージを確認
2. RLS ポリシーの構文を確認
3. テーブル名、カラム名が snake_case になっているか確認
4. すべての外部キー参照が正しいか確認

---

## 🎓 学習リソース

### 公式ドキュメント
- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)

### 統合ガイド
- [Clerk + Supabase Integration](https://clerk.com/docs/integrations/databases/supabase)
- [Supabase with Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

### ベストプラクティス
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/authentication)

---

## 📝 更新履歴

- **2025-10-01**: 初版作成
  - すべてのベストプラクティスファイルを統合
  - マスター統合プロンプトを作成
  - 自動化フローを確立

---

## 🤝 コントリビューション

新しいベストプラクティスや改善案がある場合：

1. 公式ドキュメントの最新情報を確認
2. 該当するファイルを更新
3. マスタープロンプトに反映が必要か検討

---

## ⚠️ 重要な注意事項

1. **セキュリティ**
   - 環境変数を Git にコミットしない
   - `SUPABASE_SERVICE_ROLE_KEY` は絶対に公開しない
   - すべてのテーブルで RLS を有効化

2. **パフォーマンス**
   - RLS ポリシーで使用するカラムにインデックスを作成
   - 必要最小限のデータのみをクエリ

3. **スケーラビリティ**
   - Realtime は必要な場合のみ使用
   - 専用トピックでスコープを限定

---

**質問や問題がある場合は、各ベストプラクティスファイルを参照するか、公式ドキュメントを確認してください。**
