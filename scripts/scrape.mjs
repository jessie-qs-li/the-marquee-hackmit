#!/usr/bin/env node
/* Scrape this week's showtimes from the cinemas in venues.mjs and write
 * data/screenings.json, which index.html loads at startup.
 *
 *   node scripts/scrape.mjs            # the next 7 days
 *   node scripts/scrape.mjs --days 14
 *   node scripts/scrape.mjs --only ff,mg
 *
 * Scraping runs here rather than in the page because the cinemas' sites send
 * no CORS headers -- the browser cannot read them directly. */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VENUES as NYC_VENUES } from "./venues.mjs";
import * as S from "./scrapers.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i+1] ? process.argv[i+1] : dflt;
};
import { BOSTON_VENUES } from "./boston-venues.mjs";
import { enrichGenres } from "./genres.mjs";
const CITY=arg("--city","nyc");
if(!["nyc","boston"].includes(CITY))throw new Error("Unknown city");
const VENUES=CITY==="boston"?BOSTON_VENUES:NYC_VENUES;
const outputFile=CITY==="boston"?"screenings-boston.json":"screenings.json";
const DAYS = Math.max(1, Math.min(31, +arg("--days", 7)));
const ONLY = arg("--only", "") ? arg("--only","").split(",").map(s=>s.trim()) : null;

const pad = n => String(n).padStart(2,"0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

const today = new Date();
const week  = Array.from({length:DAYS}, (_,i) => {
  const d = new Date(today); d.setDate(d.getDate()+i); return iso(d);
});
const ctx = { today, week };

const targets = VENUES.filter(v => !ONLY || ONLY.includes(v.id));
const report = [];
const rows = [];

console.log(`\nThe Marquee — scraping ${week[0]} … ${week.at(-1)}\n`);

for(const v of targets){
  if(!v.scrape){
    report.push({ id:v.id, name:v.name, ok:false, count:0, skipped:true, error:v.blocked });
    console.log(`  ○ ${v.name.padEnd(34)} skipped — ${v.blocked}`);
    continue;
  }
  const fn = S[v.scrape];
  if(typeof fn !== "function"){
    report.push({ id:v.id, name:v.name, ok:false, count:0, error:`no adapter "${v.scrape}"` });
    console.log(`  ✗ ${v.name.padEnd(34)} no adapter "${v.scrape}"`);
    continue;
  }
  const t0 = Date.now();
  try {
    const got = await fn(v, ctx);
    const seen = new Set();
    let n = 0;
    for(const s of got){
      if(!s.title || !s.date || !s.time) continue;
      const key = `${v.id}|${s.date}|${s.time}|${s.title}`;
      if(seen.has(key)) continue;
      seen.add(key);
      rows.push({ venue:v.id, ...s });
      n++;
    }
    if(n === 0 && !v.allowEmpty) throw new Error("parsed 0 showtimes — the page layout probably changed");
    if(n === 0){
      report.push({ id:v.id, name:v.name, ok:true, count:0, empty:true, ms:Date.now()-t0 });
      console.log(`  – ${v.name.padEnd(34)} nothing scheduled in range`);
      continue;
    }
    report.push({ id:v.id, name:v.name, ok:true, count:n, ms:Date.now()-t0 });
    console.log(`  ✓ ${v.name.padEnd(34)} ${String(n).padStart(4)} showtimes  (${Date.now()-t0}ms)`);
  } catch(err){
    report.push({ id:v.id, name:v.name, ok:false, count:0, error:err.message });
    console.log(`  ✗ ${v.name.padEnd(34)} ${err.message}`);
  }
}

rows.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.venue.localeCompare(b.venue));

const genreCoverage=await enrichGenres(rows,{root:ROOT});
const out = {
  city:CITY, genreCoverage,
  fetchedAt: new Date().toISOString(),
  week,
  venues: Object.fromEntries(VENUES.map(v => [v.id, {
    n:v.name, sn:v.sn, hood:v.hood, boro:v.boro, kind:v.kind, price:v.price, about:v.about, url:v.url
  }])),
  sources: report,
  screenings: rows
};

mkdirSync(resolve(ROOT,"data"), { recursive:true });
writeFileSync(resolve(ROOT,"data",outputFile), JSON.stringify(out, null, 1));

const live = report.filter(r=>r.ok).length;
const dead = report.filter(r=>!r.ok && !r.skipped).length;
const skip = report.filter(r=>r.skipped).length;
console.log(`\n  ${rows.length} showtimes from ${live} venues — ${dead} failed, ${skip} without an adapter`);
console.log(`  wrote data/${outputFile}\n`);
