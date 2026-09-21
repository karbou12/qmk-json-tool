#!/usr/bin/env node

/**
 * JS & JSON 差分再計算 CLI ツール (オプション強化版)
 * 使い方:
 *   node qmk-diff.js [file.diff]
 *   git diff | node qmk-diff.js
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
  node qmk-diff.js [options] [file]
  cat file.diff | node qmk-diff.js [options]

Options:
  --full             : 差分のない行も含め、すべての行を出力します
  -c, --context <n>  : 差分の前後に出力する共通行の数を指定します (デフォルト: 3)
  --no-color         : ターミナルの色付け(ANSIエスケープ)を無効化し、プレーンテキストで出力します
  -h, --help         : ヘルプを表示します

Examples:
  git diff | node qmk-diff.js
  git diff | node qmk-diff.js --full --no-color > expanded.diff
  node qmk-diff.js -c 5 patch.diff
  `);
}

// ターミナル出力用のカラーコード（ANSIエスケープシーケンス）
const C_RESET = noColor ? "" : "\x1b[0m";
const C_RED = noColor ? "" : "\x1b[31m";
const C_GREEN = noColor ? "" : "\x1b[32m";
const C_BLUE = noColor ? "" : "\x1b[34m";

// データの読み込み
if (filePath) {
  try {
    const data = fs.readFileSync(path.resolve(filePath), 'utf8');
    execute(data);
  } catch (err) {
    console.error(`❌ ファイルの読み込みに失敗しました: \${err.message}`);
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
  const fullMatch = match[0], quoteType = match[1];
  let jsonStr = match[2];
  try {
    jsonStr = new Function(`return ${quoteType}${jsonStr}${quoteType}`)();
  } catch(e) {}
  try {
    const parsedObj = JSON.parse(jsonStr);
    const prettyJSONLines = JSON.stringify(parsedObj, null, 2).split('\n');
    const prefix = line.substring(0, line.indexOf(fullMatch));
    const suffix = line.substring(line.indexOf(fullMatch) + fullMatch.length);
    let result = [prefix + "JSON.parse(" + quoteType + " /* --- 埋め込みJSONを展開表示 --- */"];
    prettyJSONLines.forEach(jLine => result.push("      " + jLine));
    result.push("    " + quoteType + ")" + suffix);
    return result;
  } catch (e) {
    return [line];
  }
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
  let lRawLines = [], rRawLines = [];
  
  src.split('\n').forEach(l => {
    if (l.startsWith('diff --git') || l.startsWith('index ') || l.startsWith('--- ') || l.startsWith('+++ ') || l.startsWith('@@ ')) return;
    if (l.startsWith('-')) lRawLines.push(l.slice(1));
    else if (l.startsWith('+')) rRawLines.push(l.slice(1));
    else {
      const clean = l.startsWith(' ') ? l.slice(1) : l;
      lRawLines.push(clean); rRawLines.push(clean);
    }
  });

  let lLines = [], rLines = [];
  lRawLines.forEach(line => lLines = lLines.concat(expandLineWithJSON(line)));
  rRawLines.forEach(line => rLines = rLines.concat(expandLineWithJSON(line)));

  if (lLines.length === 0 && rLines.length === 0) {
    console.error('⚠️ 有効な差分データが検出されませんでした。');
    process.exit(1);
  }

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
        console.log(`${C_BLUE}@@ ··· [ 省略部分 ] ··· @@${C_RESET}`);
        skip = false;
      }
      if (x.t === 'c') {
        console.log(`  ${x.v}`);
      } else if (x.t === 'm') {
        console.log(`${C_RED}- ${x.v}${C_RESET}`);
      } else if (x.t === 'p') {
        console.log(`${C_GREEN}+ ${x.v}${C_RESET}`);
      }
    } else {
      skip = true;
    }
  });
}

