#!/usr/bin/env node

/**
 * JSON & JSコード コンフリクト解消 CLI ツール
 * 使い方:
 *   node qmk-conflict.js [conflict_file.js]
 *   cat conflict_file.js | node qmk-conflict.js
 */

const fs = require('fs');
const path = require('path');

// 引数の解析
const args = process.argv.slice(2);

// オプションの初期値
let noColor = false;
let fullOutput = false;
let contextLines = 3;
let filePath = null;

// 引数のパース
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--no-color') {
    noColor = true;
  } else if (arg === '--full') {
    fullOutput = true;
  } else if (arg === '--context' || arg === '-c') {
    const val = parseInt(args[i + 1]);
    if (!isNaN(val)) {
      contextLines = val;
      i++;
    }
  } else if (arg === '--help' || arg === '-h') {
    showHelp();
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    filePath = arg;
  }
}

function showHelp() {
  console.log(`
Usage:
  node qmk-conflict.js [options] [file]
  cat conflict_file.js | node qmk-conflict.js [options]

Options:
  --full             : 差分のない共通行も含め、すべての行を出力します
  -c, --context <n>  : 衝突箇所の前後に出力する共通行の数を指定します (デフォルト: 3)
  --no-color         : ターミナルの色付け(ANSIエスケープ)を無効化し、プレーンテキストで出力します
  -h, --help         : ヘルプを表示します

Examples:
  node qmk-conflict.js keymap.js
  cat conflict.js | node qmk-conflict.js --full
  `);
}

// ターミナル出力用のカラーコード（ANSIエスケープシーケンス）
const C_RESET = noColor ? "" : "\x1b[0m";
const C_RED = noColor ? "" : "\x1b[31m";
const C_GREEN = noColor ? "" : "\x1b[32m";
const C_BLUE = noColor ? "" : "\x1b[34m";
const C_CYAN = noColor ? "" : "\x1b[36m";

// データの読み込み
if (filePath) {
  try {
    const data = fs.readFileSync(path.resolve(filePath), 'utf8');
    execute(data);
  } catch (err) {
    console.error(`❌ ファイルの読み込みに失敗しました: ${err.message}`);
    process.exit(1);
  }
} else {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => { execute(data); });
}

// 1行のJSコードからJSON.parse('...')を抽出し、インデント付き複数行に展開する
function expandLineWithJSON(line) {
  const match = line.match(/JSON\.parse\((['"`])([\s\S]*?)\1\)/);
  if (!match) return [line];
  const fullMatch = match[0], quoteType = match[1]; let jsonStr = match[2];
  try { jsonStr = new Function(`return ${quoteType}${jsonStr}${quoteType}`)(); } catch(e) {}
  try {
    const parsedObj = JSON.parse(jsonStr);
    const prettyJSONLines = JSON.stringify(parsedObj, null, 2).split('\n');
    const prefix = line.substring(0, line.indexOf(fullMatch));
    const suffix = line.substring(line.indexOf(fullMatch) + fullMatch.length);
    let result = [prefix + "JSON.parse(" + quoteType + " /* --- 埋め込みJSONを展開表示 --- */"];
    prettyJSONLines.forEach(jLine => result.push("      " + jLine));
    result.push("    " + quoteType + ")" + suffix);
    return result;
  } catch (e) { return [line]; }
}

// LCS（最長共通部分系列）アルゴリズム
function calc(O, N) {
  let m = O.length, n = N.length, dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = (O[i - 1] === N[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  let i = m, j = n, res = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && O[i - 1] === N[j - 1]) { res.unshift({ t: 'c', v: O[i - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { res.unshift({ t: 'p', v: N[j - 1] }); j--; }
    else { res.unshift({ t: 'm', v: O[i - 1] }); i--; }
  }
  return res;
}

// 実行コア処理
function execute(src) {
  let lRawLines = [], rRawLines = [], mode = 'common';
  
  // 1. コンフリクトマーカーを解析して分離
  src.split('\n').forEach(l => {
    if (l.startsWith('<<<<<<<')) { mode = 'left'; }
    else if (l.startsWith('=======')) { mode = 'right'; }
    else if (l.startsWith('>>>>>>>')) { mode = 'common'; }
    else {
      if (mode === 'common') { lRawLines.push(l); rRawLines.push(l); }
      else if (mode === 'left') { lRawLines.push(l); }
      else if (mode === 'right') { rRawLines.push(l); }
    }
  });

  // 2. 埋め込みJSONの展開
  let lLines = [], rLines = [];
  lRawLines.forEach(line => lLines = lLines.concat(expandLineWithJSON(line)));
  rRawLines.forEach(line => rLines = rLines.concat(expandLineWithJSON(line)));

  if (lLines.length === 0 && rLines.length === 0) {
    console.error('⚠️ コンフリクトデータ（<<<<<<< 等）が検出されませんでした。');
    process.exit(1);
  }

  // 3. 差分の再計算
  const raw = calc(lLines, rLines);
  
  // 4. フィルタリングフラグの計算
  const mid = raw.map(x => ({ ...x, isD: (x.t === 'm' || x.t === 'p'), show: fullOutput }));

  if (!fullOutput) {
    for (let i = 0; i < mid.length; i++) {
      if (mid[i].isD) {
        for (let k = Math.max(0, i - contextLines); k <= Math.min(mid.length - 1, i + contextLines); k++) {
          mid[k].show = true;
        }
      }
    }
  }

  // 5. ターミナルへ出力
  let skip = false;
  mid.forEach(x => {
    if (x.show) {
      if (skip) {
        console.log(`${C_BLUE}@@ ··· [ 衝突のない共通部分を省略 ] ··· @@${C_RESET}`);
        skip = false;
      }
      if (x.t === 'c') {
        console.log(`  ${x.v}`);
      } else if (x.t === 'm') {
        // 現在の変更（HEAD）を赤色で出力
        console.log(`${C_RED}<<<<<<< HEAD      : ${x.v}${C_RESET}`);
      } else if (x.t === 'p') {
        // 取り込みたい変更を緑色で出力
        console.log(`${C_GREEN}>>>>>>> Incoming  : ${x.v}${C_RESET}`);
      }
    } else {
      skip = true;
    }
  });
}

