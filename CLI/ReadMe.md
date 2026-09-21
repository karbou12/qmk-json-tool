# 💻 QMK/ZMK用 JSON 改行整形ツールキット - CLI版 (Node.js)

QMK/ZMK Firmwareのキーコード設定ファイルや、JavaScriptファイルに埋め込まれたJSONを、ターミナル（CUI）から処理・分析するための単機能CLIツール群です。
UNIX哲学に基づき、パイプライン（`|`）やリダイレクト（`>`）とシームレスに連携できます。

---

## 🚀 ツール一覧と使い方

### 1. 🔀 `qmk-json.js` (1行 ⇔ 改行整形 相互変換)
独自アルゴリズムを搭載。一般的なパースツールでは破壊されがちな、ユニコード、バックスラッシュの連続（`\\`）、末尾のカンマなどを文字単位で完全に退避・保護したまま変換します。

* **改行整形 (インデント付き展開):**
  ```bash
  node qmk-json.js --pretty keymap.json > pretty.json
  # 短縮形
  node qmk-json.js -p keymap.json
  ```
* **1行圧縮 (スペースなしミニファイ):**
  ```bash
  node qmk-json.js --minify pretty.json > minified.json
  # 短縮形
  node qmk-json.js -m pretty.json
  ```
* **パイプ連携:**
  ```bash
  cat keymap.json | node qmk-json.js -p
  ```

---

### 2. 🔍 `qmk-diff.js` (JS & 埋め込みJSON 再差分計算)
JavaScriptコードの1行に埋め込まれた巨大な `JSON.parse('...')` を自動検知し、インデント展開してから行単位で差分を再計算します。

* **基本実行 (自動で前後3行に絞り込み ＋ ターミナル色付け):**
  ```bash
  git diff | node qmk-diff.js
  ```
* **ファイル直接指定:**
  ```bash
  node qmk-diff.js patch.diff
  ```
* **全行出力 (`--full`) ＆ 色なしプレーンテキスト (`--no-color`):**
  ```bash
  # 他のファイルへ保存したり、別のコマンドに渡す時に便利です
  git diff | node qmk-diff.js --full --no-color > expanded.diff
  ```
* **絞り込み行数の変更 (`-c / --context`):**
  ```bash
  git diff | node qmk-diff.js -c 5
  ```

---

### 3. ⚡ `qmk-conflict.js` (コンフリクト自動展開・可視化)
マージやリベース時に発生した `<<<<<<<`, `=======`, `>>>>>>>` を含むコードファイルを解析し、「HEAD (現在の変更)」と「Incoming (取り込みたい変更)」に分離。さらに埋め込みJSONを自動展開して衝突箇所を美しく可視化します。

* **基本実行 (衝突箇所の前後3行を色付きで表示):**
  ```bash
  node qmk-conflict.js conflict_file.js
  ```
* **パイプ連携 ＋ 全行出力:**
  ```bash
  cat conflict_file.js | node qmk-conflict.js --full
  ```

---

## 🛠️ インストールと独自コマンド化 (Mac / Linux / WSL)

毎回 `node 〇〇.js` と入力するのが面倒な場合は、以下の手順でシステム全体にショートカット（独自コマンド）として登録できます。

1. 各スクリプトの実行権限を許可します：
   ```bash
   chmod +x qmk-json.js qmk-diff.js qmk-conflict.js
   ```
2. `package.json` を同じフォルダに作成、または `npm link` を使ってシンボリックリンクを張ることで、以下の短いコマンドだけでどこからでも呼び出せるようになります：
   * `qmk-json -p input.json`
   * `git diff | qmk-diff`
   * `qmk-conflict file.js`

---

## 🔒 セキュリティ

本ツールは外部のネットワークやサーバーと通信することは一切ありません。
完全にローカルのNode.js環境（オフライン環境）で安全にソースコードや機密データを処理できます。

---

## 🤖 開発の経緯

筆者はKeychron Nape Proの機能追加のために、Keychron LauncherをGoogle Chrome Developer ToolのOverrideを使って拡張しています。  
Keychron Launcherが更新されるとマージ・コンフリクト解消が必要になりますが、特にキーマップのJSONに差分が生じたときのコンフリクト解消や、キーマップ追加に手間がかかっていたため、
このツールキットを開発しました。  
本ツールのコアロジックおよびCLIインターフェースは、**Google Gemini** とのプロンプトによる試行錯誤とデバッグを経て共同開発されました。
