#!/usr/bin/env node

/**
 * QMK & JSON 相互変換 CLI ツール (スコープバグ完全修正版)
 */

const fs = require('fs');
const path = require('path');

// --- 1. グローバル変数の宣言と初期化をファイルの最上部に固定 ---
let qmkProtectedMarkers = [];

/* ==========================================================================
   QMK対応 強力パースロジック (スコープバグ対策版)
   ========================================================================== */
function prot(s) {
  qmkProtectedMarkers = []; 
  let inStr = false, i = 0, res = "", t = s.trim();
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
      if (len > 0) {
        let id = "___RE_" + qmkProtectedMarkers.length + "___";
        qmkProtectedMarkers.push({ id, v: chunk }); 
        res += id; 
        i += len; 
        continue;
      }
    }
    if (c === '"' && (i === 0 || t[i-1] !== '\\' || (i > 1 && t[i-2] === '\\' && t[i-1] === '\\'))) inStr = !inStr;
    res += c; i++;
  }
  return res;
}

function rest(s) {
  let out = s; 
  for (let i = qmkProtectedMarkers.length - 1; i >= 0; i--) {
    out = out.replaceAll(qmkProtectedMarkers[i].id, qmkProtectedMarkers[i].v); 
  } 
  return out;
}

function parseJ(s) {
  const t = prot(s);
  try { return { d: JSON.parse(t), f: false }; }
  catch (e) {
    let c = t.endsWith(',') ? t.slice(0, -1) : t;
    try { return { d: JSON.parse("[" + c + "]"), f: true }; } catch (e2) { throw e; }
  }
}

// 引数の解析
const args = process.argv.slice(2);
const mode = args[0]; // --pretty または --minify
const filePath = args[1];

// ヘルプ表示
if (!mode || (mode !== '--pretty' && mode !== '-p' && mode !== '--minify' && mode !== '-m')) {
  console.log(`
Usage:
  node qmk-json.js [mode] [file]

Modes:
  -p, --pretty   : 1行JSONを綺麗なインデント付きの改行整形JSONに変換
  -m, --minify   : 改行整形JSONをスペースなしの1行JSONに圧縮

Examples:
  node qmk-json.js --pretty keymap.json > pretty.json
  cat pretty.json | node qmk-json.js --minify > minified.json
  `);
  process.exit(0);
}

// 実行コア処理
function execute(inputRaw) {
  let raw = inputRaw.trim();
  if (!raw) return;
  
  let comma = raw.endsWith(','); 
  if (comma) raw = raw.slice(0, -1);

  if (mode === '--pretty' || mode === '-p') {
    try {
      const r = parseJ(raw);
      let out = r.f ? r.d.map(o => JSON.stringify(o, null, 4)).join(',\n') + (comma ? ',' : '') : JSON.stringify(r.d, null, 4);
      console.log(rest(out));
    } catch (e) {
      let out = raw.replace(/\{/g, '{\n ').replace(/\}/g, '\n}').replace(/,/g, ',\n ') + (comma ? ',' : '');
      console.log(out);
      console.error(`⚠️ JSON構文エラーが発生したため簡易整形しました: ${e.message}`);
    }
  } else if (mode === '--minify' || mode === '-m') {
    try {
      const r = parseJ(raw);
      let out = r.f ? r.d.map(o => JSON.stringify(o)).join(',') + (comma ? ',' : '') : JSON.stringify(r.d);
      console.log(rest(out));
    } catch (e) {
      let out = raw.split('\n').map(l => l.replace(/^\s+/, '')).join('') + (comma ? ',' : '');
      console.log(out);
      console.error(`⚠️ JSON構文エラーが発生したため外側のインデントのみ除去しました: ${e.message}`);
    }
  }
}

// 2. データの流し込み処理を初期化・関数宣言のあとに配置
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

