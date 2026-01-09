# GitHubセットアップガイド

このプロジェクトをGitHubで管理するための手順です。

## 📋 必要な作業

### 1. Gitのインストール（未インストールの場合）

1. [Git公式サイト](https://git-scm.com/download/win)からGit for Windowsをダウンロード
2. インストーラーを実行してインストール
3. インストール後、PowerShellまたはコマンドプロンプトを再起動

### 2. GitHubアカウントの作成（未作成の場合）

1. [GitHub](https://github.com)にアクセス
2. 「Sign up」からアカウントを作成

### 3. ローカルリポジトリの初期化

プロジェクトディレクトリで以下のコマンドを実行：

```bash
# Gitリポジトリを初期化
git init

# 現在のファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit: プロジェクト仕様書と基本ファイルの追加"
```

### 4. GitHubでリポジトリを作成

1. GitHubにログイン
2. 右上の「+」ボタンから「New repository」を選択
3. リポジトリ名を入力（例：`ActionPlus`）
4. 説明を追加（オプション）
5. PublicまたはPrivateを選択
6. **「Initialize this repository with a README」はチェックしない**（既にREADME.mdがあるため）
7. 「Create repository」をクリック

### 5. ローカルリポジトリをGitHubに接続

GitHubでリポジトリ作成後、表示されるコマンドを実行：

```bash
# リモートリポジトリを追加（YOUR_USERNAMEを実際のユーザー名に置き換え）
git remote add origin https://github.com/YOUR_USERNAME/ActionPlus.git

# メインブランチをmainに設定（GitHubのデフォルト）
git branch -M main

# GitHubにプッシュ
git push -u origin main
```

### 6. 今後の作業フロー

#### ファイルを変更した場合

```bash
# 変更を確認
git status

# 変更をステージング
git add .

# コミット
git commit -m "変更内容の説明"

# GitHubにプッシュ
git push
```

#### 新しいファイルを追加した場合

```bash
git add ファイル名
git commit -m "新機能の追加"
git push
```

## 📝 注意事項

- `.gitignore`ファイルで不要なファイルが除外されます
- コミットメッセージは変更内容が分かるように記述してください
- 定期的に`git push`を実行して、変更をGitHubに保存してください

## 🔗 参考リンク

- [Git公式ドキュメント](https://git-scm.com/doc)
- [GitHub公式ドキュメント](https://docs.github.com/ja)
- [GitHub Desktop](https://desktop.github.com/) - GUIでGitを操作したい場合


