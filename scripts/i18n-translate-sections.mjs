#!/usr/bin/env node
// Translates specific sections (solo, game) of app/dictionaries/en.json into each
// locale via Gemini and MERGES them into the existing locale dictionaries
// (preserving the already-translated meta/landing sections). Idempotent per run.
//   Usage: GEMINI_API_KEY=... node scripts/i18n-translate-sections.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DICT = join(ROOT, 'app/dictionaries');
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY not set'); process.exit(1); }
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const SECTIONS = ['solo', 'game'];
const LOCALES = ['es', 'pt-br', 'fr', 'de', 'vi', 'th'];
const LANGNAME = { es: 'Spanish', 'pt-br': 'Brazilian Portuguese', fr: 'French', de: 'German', vi: 'Vietnamese', th: 'Thai' };
const KEEP = ['1v1 Minesweeper', 'AI', 'Hackatoa'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const en = JSON.parse(readFileSync(join(DICT, 'en.json'), 'utf8'));

async function translateBatch(strings, langName, code) {
  if (!strings.length) return [];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const prompt = `Translate each string in this JSON array from English into ${langName} (locale "${code}").
Return ONLY a JSON array of the same length and order — one translation per input string.
Rules:
- Natural, idiomatic for native speakers. This is a competitive 1v1 Minesweeper browser game.
- Preserve leading/trailing whitespace and any {name} style placeholder tokens EXACTLY.
- Keep emoji and symbols (⛏️ 🚩 💣 🎯 🧠 ⚡ · — etc.) EXACTLY.
- Do NOT translate: ${KEEP.join(', ')}.
- If a string is only an emoji/symbol/number, return it unchanged.
Input:
${JSON.stringify(strings)}`;
  for (let a = 1; a <= 6; a++) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' } }) });
    const data = await res.json().catch(() => ({}));
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (txt) { try { const arr = JSON.parse(txt); if (Array.isArray(arr) && arr.length === strings.length) return arr; } catch {} }
    const s = data?.error?.status || res.status;
    console.warn(`    batch retry ${a} (${s})`);
    await sleep(s === 'RESOURCE_EXHAUSTED' ? 20000 : 2000 * a);
  }
  throw new Error('translateBatch failed');
}

for (const loc of LOCALES) {
  const target = JSON.parse(readFileSync(join(DICT, `${loc}.json`), 'utf8'));
  for (const sec of SECTIONS) {
    const keys = Object.keys(en[sec]);
    const vals = keys.map((k) => en[sec][k]);
    const tr = [];
    for (let i = 0; i < vals.length; i += 12) {
      const part = await translateBatch(vals.slice(i, i + 12), LANGNAME[loc], loc);
      tr.push(...part);
    }
    target[sec] = {};
    keys.forEach((k, i) => { target[sec][k] = tr[i]; });
  }
  writeFileSync(join(DICT, `${loc}.json`), JSON.stringify(target, null, 2) + '\n');
  console.log(`${loc.padEnd(5)} -> merged solo+game`);
  await sleep(1000);
}
console.log('Done.');
