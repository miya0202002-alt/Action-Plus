# ⚡ クイックスタート：コピペで使えるプロンプト集

このファイルには、すぐに使えるプロンプトテンプレートが含まれています。
状況に応じて適切なプロンプトをコピーして、AIアシスタントに貼り付けてください。

---

## 🎯 シナリオ別プロンプト

### シナリオ 1: ゼロからの完全統合 + フロントエンド実装（最も推奨）

プロジェクトに Supabase と Clerk を統合し、認証機能付きのUIも実装したい場合：

```
以下のベストプラクティスファイルをすべて読み込んでください：

@supabase_prompt/clerk_setupprpompt.md
@supabase_prompt/supabase_bootstrap_nextjs_app_with_SupabaseAuth.md
@supabase_prompt/supabase_migration_prompt.md
@supabase_prompt/supabase_postgres_SQL_Style_guide.md
@supabase_prompt/supabase_realtime_AIprompt.md
@supabase_prompt/FRONTEND_IMPLEMENTATION_ADDON.md

次に、@supabase_prompt/MASTER_INTEGRATION_PROMPT.md の内容に従って、
このプロジェクトに Supabase と Clerk を完全に統合してください。

設計ドキュメントは /docs/ フォルダにあります。
- system_architecture.md または類似のファイルからシステム設計を読み取る
- database_design.md または類似のファイルからデータベース構造を読み取る
- その他の関連ドキュメントも参照する

フロントエンド実装も含めてください：
- サインイン/サインアップページ
- Protected routes（認証が必要なページ）
- ナビゲーションヘッダー
- データの CRUD 操作 UI
- Server Actions
- ローディング・エラー状態の UI
- Service Role ユーティリティ（Clerk と Supabase の同期）

実装完了後は、私が実行すべき手順（Clerk Dashboard 設定、Supabase 設定、環境変数、service role を使う Server Actions の確認など）を詳細に説明してください。
```

---

### シナリオ 1-B: バックエンドのみ統合（フロントエンドは手動で実装）

認証基盤とデータベースのみを統合し、UIは後で作成する場合：

```
以下のベストプラクティスファイルをすべて読み込んでください：

@supabase_prompt/clerk_setupprpompt.md
@supabase_prompt/supabase_bootstrap_nextjs_app_with_SupabaseAuth.md
@supabase_prompt/supabase_migration_prompt.md
@supabase_prompt/supabase_postgres_SQL_Style_guide.md
@supabase_prompt/supabase_realtime_AIprompt.md

次に、@supabase_prompt/MASTER_INTEGRATION_PROMPT.md の内容に従って、
このプロジェクトに Supabase と Clerk を完全に統合してください。

設計ドキュメントは /docs/ フォルダにあります。

注意：フロントエンド実装（フェーズ 10）はスキップして、
認証基盤とデータベース統合のみを実装してください。

実装完了後は、私が実行すべき手順を詳細に説明してください。
```

---

### シナリオ 2: Clerk のみを追加

既存のプロジェクトに Clerk 認証を追加したい場合：

```
@supabase_prompt/clerk_setupprpompt.md を読み込んで、
このプロジェクトに Clerk による Google OAuth 認証を実装してください。

要件：
- Next.js App Router を使用
- Google OAuth のみを有効化
- サインイン後は / にリダイレクト

必ず最新の clerkMiddleware() パターンを使用し、
authMiddleware は使用しないでください。

実装完了後、以下を教えてください：
1. Clerk Dashboard で実行すべき設定手順
2. 必要な環境変数とその取得方法
3. 動作確認の方法
```

---

### シナリオ 3: Supabase のみを追加

既存のプロジェクトに Supabase を追加したい場合：

```
@supabase_prompt/supabase_bootstrap_nextjs_app_with_SupabaseAuth.md を読み込んで、
このプロジェクトに Supabase を統合してください。

要件：
- Next.js App Router を使用
- SSR 対応のクライアントを実装
- ブラウザクライアントとサーバークライアントの両方を作成

必ず @supabase/ssr パッケージを使用し、
getAll() と setAll() のみを使用してください。
get、set、remove や auth-helpers-nextjs は使用しないでください。

実装完了後、以下を教えてください：
1. Supabase Dashboard で実行すべき設定手順
2. 必要な環境変数とその取得方法
3. 使用例のサンプルコード
```

---

### シナリオ 4: データベースマイグレーション作成

特定のテーブル構造に基づいてマイグレーションファイルを作成したい場合：

```
以下のベストプラクティスを読み込んでください：

@supabase_prompt/supabase_migration_prompt.md
@supabase_prompt/supabase_postgres_SQL_Style_guide.md

次に、以下のテーブル構造に基づいて、Supabase マイグレーションファイルを作成してください：

[ここにテーブル構造を記述]
例：
- users テーブル（id, clerk_user_id, email, full_name, created_at）
- posts テーブル（id, user_id, title, content, published, created_at）
- comments テーブル（id, post_id, user_id, content, created_at）

要件：
- すべてのテーブルで RLS を有効化
- 各操作（SELECT, INSERT, UPDATE, DELETE）に対してポリシーを作成
- ユーザーは自分のデータのみアクセス可能
- posts は published=true の場合、全員が閲覧可能
- 適切なインデックスを作成
- 外部キー制約を設定

ファイル名は YYYYMMDDHHmmss_description.sql 形式で、
supabase/migrations/ ディレクトリに作成してください。
```

---

### シナリオ 5: リアルタイム機能の追加

特定のテーブルにリアルタイム更新機能を追加したい場合：

```
@supabase_prompt/supabase_realtime_AIprompt.md を読み込んで、
以下のテーブルにリアルタイム更新機能を実装してください：

テーブル名: [例: messages]
リアルタイムスコープ: [例: room ごと]

要件：
- broadcast を使用（postgres_changes は使用しない）
- データベーストリガーで自動通知
- private チャンネルで RLS を適用
- 適切なトピック名（例: room:123:messages）
- React での使用例も提供

実装内容：
1. データベーストリガー関数の作成
2. トリガーの設定
3. RLS ポリシーの作成
4. クライアント側の実装例
5. 使用方法のドキュメント
```

---

### シナリオ 6: 既存のデータベース設計からマイグレーション生成

設計ドキュメントが既にある場合：

```
以下のベストプラクティスを読み込んでください：

@supabase_prompt/supabase_migration_prompt.md
@supabase_prompt/supabase_postgres_SQL_Style_guide.md

次に、@docs/database_design.md（または類似のファイル）を読み取り、
そこに記載されているデータベース構造に基づいて、
完全なマイグレーションファイルを生成してください。

要件：
- すべてのテーブルで RLS を有効化
- 適切な RLS ポリシーを実装
- 必要なインデックスを作成
- 外部キー制約を設定
- 各テーブルとカラムにコメントを追加

ファイルは supabase/migrations/ ディレクトリに、
実行順序がわかるように番号付きで作成してください。
```

---

### シナリオ 7: Clerk と Supabase の連携

Clerk のユーザー情報を Supabase に同期したい場合：

```
@supabase_prompt/clerk_setupprpompt.md と
@supabase_prompt/supabase_bootstrap_nextjs_app_with_SupabaseAuth.md を読み込んで、
Clerk と Supabase を連携させてください。

要件：
1. Clerk でユーザーがサインアップ/サインインした際に、
   Supabase の users テーブルにユーザー情報を保存
2. users テーブルの構造：
   - id (uuid)
   - clerk_user_id (text, unique)
   - email (text)
   - full_name (text)
   - created_at (timestamp)
   - updated_at (timestamp)
3. RLS ポリシーで、ユーザーは自分のデータのみアクセス可能

実装内容：
1. マイグレーションファイルの作成
2. ユーザー作成/更新のユーティリティ関数
3. サーバーサイドでの使用例
4. Clerk の userId から Supabase のユーザー情報を取得する関数

実装完了後、service role クライアントの設定/利用手順も教えてください。
```

---

### シナリオ 8: 型安全な実装

TypeScript の型定義も含めて実装したい場合：

```
@supabase_prompt/MASTER_INTEGRATION_PROMPT.md に従って統合を実行し、
さらに以下も実装してください：

1. Supabase の型定義ファイルを生成
   - Database 型
   - 各テーブルの Row/Insert/Update 型
   - lib/supabase/types.ts に配置

2. 型安全なクライアント関数を作成
   - createClient() に型を適用
   - クエリの戻り値が型推論されるように

3. 使用例を提供
   - Server Components での使用
   - Client Components での使用
   - API Routes での使用

すべてのファイルで厳密な型チェックが通るようにしてください。
```

---

### シナリオ 9: エラーハンドリングとロギング

本番環境向けのエラーハンドリングを実装したい場合：

```
既存の Supabase と Clerk の統合に、
本番環境向けのエラーハンドリングとロギングを追加してください。

要件：
1. すべてのデータベース操作でエラーハンドリング
2. ユーザーフレンドリーなエラーメッセージ
3. 開発環境では詳細なエラーログ
4. 本番環境では機密情報を含まないログ
5. リトライロジック（必要に応じて）

実装内容：
1. エラーハンドリングユーティリティ
2. カスタムエラークラス
3. ログ関数
4. 使用例

また、以下のエラーシナリオにも対応：
- ネットワークエラー
- 認証エラー
- RLS ポリシー違反
- データベース制約違反
```

---

### シナリオ 10: フロントエンド実装のみ追加

既に Supabase と Clerk の統合は完了しており、UIのみを追加したい場合：

```
@supabase_prompt/FRONTEND_IMPLEMENTATION_ADDON.md を読み込んで、
既存の Supabase + Clerk 統合に、フロントエンド実装を追加してください。

以下を実装してください：
1. サインイン/サインアップページ
2. Protected routes（認証が必要なページ）
3. ナビゲーションヘッダー（認証状態に応じた表示切替）
4. データの CRUD 操作（設計ドキュメントに基づく）
   - Server Actions の作成
   - フォームコンポーネント
   - リスト表示コンポーネント
   - 削除確認ダイアログ
5. カスタムフック（useSupabaseUser など）
6. ローディング・エラー状態の UI
7. Service Role ユーティリティと `ensureSupabaseUser()`（ユーザー自動同期）
8. リアルタイム機能の UI（必要な場合）

設計ドキュメントは /docs/ フォルダにあります。
実装完了後、service role キーの設定方法と `ensureSupabaseUser()` の呼び出し場所を詳しく教えてください。
```

---

### シナリオ 11: テストとドキュメント

テストとドキュメントも含めた完全な実装：

```
@supabase_prompt/MASTER_INTEGRATION_PROMPT.md に従って統合を実行し、
さらに以下も追加してください：

1. ユニットテストの作成
   - Supabase クライアント関数のテスト
   - ユーティリティ関数のテスト
   - Jest または Vitest を使用

2. 統合テストの例
   - 認証フローのテスト
   - データベース操作のテスト

3. ドキュメントの生成
   - README.md の更新
   - API ドキュメント
   - 開発者ガイド
   - デプロイ手順

4. CI/CD の設定例
   - GitHub Actions ワークフロー
   - 環境変数の設定方法
   - マイグレーションの自動実行

すべてのファイルにコメントと JSDoc を追加してください。
```

---

## 🎨 カスタマイズのヒント

### プロンプトをカスタマイズする際のポイント

1. **具体的な要件を追加**
   ```
   要件：
   - ユーザーは複数の組織に所属可能
   - 各組織には管理者ロールとメンバーロールがある
   - 組織ごとにデータを分離
   ```

2. **既存のコードを参照**
   ```
   現在の app/layout.tsx の構造を保持しつつ、
   Clerk の認証機能を統合してください。
   ```

3. **フレームワークやライブラリを指定**
   ```
   UI コンポーネントには shadcn/ui を使用してください。
   フォームバリデーションには zod を使用してください。
   ```

4. **段階的な実装をリクエスト**
   ```
   まず基本的な認証機能のみを実装し、
   動作確認後にデータベース統合を行ってください。
   ```

---

## 🚨 よくある間違いと回避方法

### ❌ 悪い例

```
Clerk と Supabase を統合して
```

**問題点：**
- ベストプラクティスファイルを参照していない
- 要件が不明確
- AI が古いパターンを使用する可能性

### ✅ 良い例

```
@supabase_prompt/clerk_setupprpompt.md と
@supabase_prompt/supabase_bootstrap_nextjs_app_with_SupabaseAuth.md を読み込んで、
このプロジェクトに Clerk と Supabase を統合してください。

必ず以下を守ってください：
- clerkMiddleware() を使用（authMiddleware は使用しない）
- @supabase/ssr を使用（auth-helpers-nextjs は使用しない）
- getAll()/setAll() のみを使用

実装後、私が実行すべき設定手順を詳しく説明してください。
```

---

## 📝 プロンプト改善のチェックリスト

プロンプトを作成する際は、以下を確認：

- [ ] 適切なベストプラクティスファイルを参照している
- [ ] 具体的な要件を記載している
- [ ] 使用すべき/避けるべきパターンを明示している
- [ ] 期待する出力（ファイル、説明など）を指定している
- [ ] プロジェクト固有の制約を記載している
- [ ] 実装後のユーザーアクションを依頼している

---

## 💡 高度な使い方

### マルチステップのプロンプト

複雑な実装は段階的に進める：

**ステップ 1: 設計確認**
```
@docs/ フォルダ内の設計ドキュメントを読み取り、
データベース構造とテーブルリレーションシップをまとめてください。
実装を始める前に、構造を確認させてください。
```

**ステップ 2: マイグレーション作成**
```
確認した構造に基づいて、マイグレーションファイルを作成してください。
[ベストプラクティスファイルを参照]
```

**ステップ 3: 認証統合**
```
マイグレーションが完了したら、Clerk 認証を統合してください。
[ベストプラクティスファイルを参照]
```

### 条件付きの実装

```
@supabase_prompt/MASTER_INTEGRATION_PROMPT.md に従って統合してください。

ただし、以下の条件を考慮：
- もし /docs/ に database_design.md が存在する場合：
  → そこからスキーマを読み取る
- もし存在しない場合：
  → 基本的な users テーブルのみを作成し、私に追加情報を尋ねる

実装内容は段階的に説明し、各ステップで私の確認を取ってください。
```

---

**これらのプロンプトをベースに、プロジェクトのニーズに合わせてカスタマイズしてください！**
