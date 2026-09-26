#!/usr/bin/env node
/**
 * QMK & JSON Dev Toolkit - CLI 双方向相互変換ツール
 * 
 * 使い方:
 *   [改行整形]
 *   node json-toolkit.js -p input.json [output.json]
 *
 *   [1行圧縮 / スペースなし超ミニファイ]
 *   node json-toolkit.js -m input.json [output.json]
 *
 *   [1行圧縮 / 一般向けコロン・カンマ後スペースあり]
 *   node json-toolkit.js -m -s input.json [output.json]
 */

const fs = require('fs');

// コマンドライン引数の解析
const args = process.argv.slice(2);
if (args.length < 2 || (!args.includes('-p') && !args.includes('-m') && !args.includes('-s')  )) {
  console.log(`
Usage:
  node qmk-json.js <mode> [option] [file]

Modes:
  -p   : 1行JSONを綺麗なインデント付きの改行整形JSONに変換
  -m   : 改行整形JSONをスペースなしの1行JSONに圧縮

Options:
  -s   : 1行JSON圧縮時にコロン・カンマ後にスペースを追加

Examples:
  node qmk-json.js -p keymap.json > pretty.json
  cat pretty.json | node qmk-json.js -m -s > minified.json
  `);
  process.exit(1);
}

const mode = args.includes('-p') ? '-p' : '-m';
const addSpaceOption = args.includes('-s');

// オプションフラグを除去して純粋なファイルパスを抽出
const fileArgs = args.filter(a => a !== '-p' && a !== '-m' && a !== '-s');
const inputFile = fileArgs[0];
const outputFile = fileArgs[1]; // 省略された場合はコンソールに出力

if (!fs.existsSync(inputFile)) {
  console.error(`❌ エラー: 入力ファイル '${inputFile}' が見つかりません。`);
  process.exit(1);
}

const rawInput = fs.readFileSync(inputFile, 'utf-8').trim();

// ==========================================================================
// Web版から完全同期：QMK文字保護 ＆ 動的インデックス型スペース注入コアエンジン
// ==========================================================================
let m = [];
function prot(s) {
  m = []; let inStr = false, i = 0, res = "", t = s;
  while (i < t.length) {
    let c = t[i], n1 = t[i+1], n2 = t[i+2], n3 = t[i+3];
    if (inStr && c === '\\') {
      let chunk = "", len = 0;
      if (n1 === 'u' && /^[0-9a-fA-F]{4}$/.test(t.substr(i+2, 4))) { chunk = t.substr(i, 6); len = 6; }
      else if (n1 === 'x' && /^[0-9a-fA-F]{2}$/.test(t.substr(i+2, 2))) { chunk = t.substr(i, 4); len = 4; }
      else if (n1 === '\\' && n2 === '\\' && n3 === '\\') { chunk = '\\\\\\\\'; len = 4; }
      else if (n1 === '\\' && n2 === '"') { chunk = '\\\\"'; len = 3; }
      else if (n1 === '\\' && n2 === "'") { chunk = "\\\\'"; len = 3; }
      else if (n1 === "'") { chunk = "\\'"; len = 2; }
      else if (n1 === '\\') { chunk = '\\\\'; len = 2; }
      if (len > 0) { let id = "___RE_" + m.length + "___"; m.push({ id, v: chunk }); res += id; i += len; continue; }
    }
    if (c === '"' && (i === 0 || t[i-1] !== '\\' || (i > 1 && t[i-2] === '\\' && t[i-1] === '\\'))) inStr = !inStr;
    res += c; i++;
  }
  return res;
}
function rest(s) { let out = s; for (let i = m.length - 1; i >= 0; i--) out = out.replaceAll(m[i].id, m[i].v); return out; }

function parseJ(s) {
  const t = prot(s);
  try { return { d: JSON.parse(t), f: false }; }
  catch (e) { 
    let c = t.trim(); let comma = c.endsWith(','); if (comma) c = c.slice(0, -1); 
    try { return { d: JSON.parse("[" + c + "]"), f: true, comma: comma }; } catch (e2) { throw e; } 
  }
}

// 動的インデックス生成型・スペース注入ステートマシン関数
function injectSpacesToJSON(text) {
  if (!text) return text;
  let finalOutput = text;
  let patIndex = 0;
  const qmkPatterns = [
    { raw: '\\\\\\\\",', token: '___QMK_PAT_' + patIndex++ + '___",'},
    { raw: '\\\\\\\\":', token: '___QMK_PAT_' + patIndex++ + '___":'},
    { raw: '\\\\\\\\"',  token: '___QMK_PAT_' + patIndex++ + '___"'},
    { raw: '\\\\",',     token: '___QMK_PAT_' + patIndex++ + '___",'},
    { raw: '\\\\":',     token: '___QMK_PAT_' + patIndex++ + '___":'},
    { raw: '\\\\"',      token: '___QMK_PAT_' + patIndex++ + '___'}
  ];

  // 動的一括退避
  for (let i = 0; i < qmkPatterns.length; i++) {
    if (finalOutput.includes(qmkPatterns[i].raw)) {
      finalOutput = finalOutput.replaceAll(qmkPatterns[i].raw, qmkPatterns[i].token);
    }
  }

  // 文字列の外側だけにスペースを注入するステートマシン
  let text_len = finalOutput.length;
  let inStr = false, quoteChar = "", escaped = false, res = "", idx = 0;
  while (idx < text_len) {
    let c = finalOutput[idx];
    if (inStr) {
      if (escaped) { res += c; escaped = false; }
      else if (c === '\\') { res += c; escaped = true; }
      else if (c === quoteChar) { res += c; inStr = false; }
      else { res += c; }
      idx++;
    } else {
      if (c === '"' || c === "'") { inStr = true; quoteChar = c; escaped = false; res += c; idx++; }
      else if (c === ':') { res += ": "; idx++; while (idx < text_len && finalOutput[idx] === ' ') idx++; }
      else if (c === ',') { res += ", "; idx++; while (idx < text_len && finalOutput[idx] === ' ') idx++; }
      else { res += c; idx++; }
    }
  }

  // 動的一括復元
  for (let i = qmkPatterns.length - 1; i >= 0; i--) {
    res = res.replaceAll(qmkPatterns[i].token, qmkPatterns[i].raw);
  }
  return res;
}

// ==========================================================================
// 相互変換メイン処理
// ==========================================================================
let finalResult = "";

if (mode === '-p') {
  // 【改行整形モード】
  if (!rawInput) process.exit(0);
  try {
    const r = parseJ(rawInput);
    let out = r.f ? r.d.map(o => JSON.stringify(o, null, 4)).join(',\n') + (r.comma ? ',' : '') : JSON.stringify(r.d, null, 4);
    finalResult = rest(out);
  } catch (e) {
    console.error("❌ JSON構文エラー: 改行整形に失敗しました。", e.message);
    process.exit(1);
  }
} else if (mode === '-m') {
  // 【1行圧縮モード】
  if (!rawInput) process.exit(0);
  try {
    const r = parseJ(rawInput);
    let out = r.f ? r.d.map(o => JSON.stringify(o)).join(',') + (r.comma ? ',' : '') : JSON.stringify(r.d);
    finalResult = rest(out);

    // 引数に -s が指定されている場合のみスペースを注入
    if (addSpaceOption) {
      finalResult = injectSpacesToJSON(finalResult);
    }
  } catch (e) {
    // 構文エラー時のフォールバック（文字列内のスペースを完全に守る最新仕様）
    let fallbackOut = rawInput.split('\n').map(l => l.replace(/^\s+/, '')).join('');
    if (addSpaceOption) {
      fallbackOut = injectSpacesToJSON(fallbackOut);
    }
    finalResult = fallbackOut;
  }
}

// 結果の出力（ファイル指定があれば書き込み、なければ標準出力）
if (outputFile) {
  fs.writeFileSync(outputFile, finalResult, 'utf-8');
  console.log(`\n🎉 変換が正常に完了し、'${outputFile}' へ保存されました！`);
} else {
  process.stdout.write(finalResult + "\n");
}

