# 💻 QMK/ZMK用 JSON 改行整形ツールキット - CLI版 (Node.js)

以下のコマンド例はリポジトリの `tools` ディレクトリで実行します。QMK/ZMK Firmwareのキーコード設定ファイルや、JavaScriptファイルに埋め込まれたJSONを、ターミナル（CUI）から処理・分析するためのCLIツール群です。
UNIX哲学に基づき、パイプライン（`|`）やリダイレクト（`>`）とシームレスに連携できます。

---

## 🚀 ツール一覧と使い方

### 1. 🔀 `qmk-json.js` (1行 ⇔ 改行整形 相互変換)
独自の文字保護処理を使い、ユニコード表記、連続するバックスラッシュ（`\\`）、要素列末尾のカンマなどを保護して変換します。

* **改行整形 (インデント付き展開):**
  ```bash
  node qmk-json.js -p keymap.json > pretty.json
  ```
* **1行圧縮 (スペースなしミニファイ):**

  * A. QMK最優先：スペースを1文字も入れずに極限まで詰め切る
    ```bash
    node qmk-json.js -m pretty.json > minified.json
    ```
  * B. 可読性優先：コロン・カンマの後にだけ半角スペースを空ける (一般JSON向け)
    ```bash
    node qmk-json.js -m -s pretty.json > minified.json
    ```
* **入力方法:** 入力ファイルは省略できます。省略時は標準入力から読み込みます。出力は常に標準出力です。
  ```bash
  node qmk-json.js -p keymap.json > pretty.json
  cat keymap.json | node qmk-json.js -p
  ```

---

### 2. 🔍 `qmk-diff.js` (JS & 埋め込みJSON 再差分計算)
JavaScriptコード中の `JSON.parse('...')` を自動検知します。呼び出しやJSON文字列が複数行に分かれている場合も結合してJSONをインデント展開し、左右の内容を行単位で再比較します。

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
マージやリベース時に発生した `<<<<<<<`, `=======`, `>>>>>>>` を含むコードファイルを解析し、「HEAD (現在の変更)」と「Incoming (取り込みたい変更)」に分離します。複数行に分かれた呼び出しを含め、埋め込みJSONを展開して衝突箇所を比較します。

* **基本実行 (衝突箇所の前後3行を色付きで表示):**
  ```bash
  node qmk-conflict.js conflict_file.js
  ```
* **パイプ連携 ＋ 全行出力:**
  ```bash
  cat conflict_file.js | node qmk-conflict.js --full
  ```

---

## 🛠️ 実行方法

Node.jsをインストールし、`tools` ディレクトリで `node` を使って各スクリプトを実行します。これらのスクリプトにはnpmのグローバルコマンド登録設定は含まれていません。

リポジトリのルートから実行する場合は、たとえば次のようにパスを指定します：

```bash
node qmk-json.js -p testdata/minify.json
git diff | node qmk-diff.js
node qmk-conflict.js testdata/conflict.json
```

---

## 🔒 セキュリティ

CLIツールは入力ファイルまたは標準入力をローカルで処理し、外部ネットワークへデータを送信しません。オフラインでも利用できます。

---

## 🤖 開発の経緯

筆者はKeychron Nape Proの機能追加のために、Keychron LauncherをGoogle Chrome Developer ToolのOverrideを使って拡張しています。  
Keychron Launcherが更新されるとマージ・コンフリクト解消が必要になりますが、特にキーマップのJSONに差分が生じたときのコンフリクト解消や、キーマップ追加に手間がかかっていたため、
このツールキットを開発しました。  
本ツールのコアロジックおよびCLIインターフェースは、**Google Gemini** とのプロンプトによる試行錯誤とデバッグを経て共同開発されました。

