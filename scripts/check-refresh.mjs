#!/usr/bin/env node
/* Gate between scraping and publishing.
 *
 * An unattended hourly job must never replace a good schedule with a broken
 * one: a network blip, a site redesign or a new bot wall would otherwise empty
 * the live board. This compares what was just scraped against what is already
 * committed and fails loudly if the new data looks collapsed.
 *
 * It also reports whether anything actually changed, ignoring the fetchedAt
 * stamp, so a quiet hour produces no commit and no deploy.
 *
 *   node scripts/check-refresh.mjs            # writes changed=… to $GITHUB_OUTPUT
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const FILES = ["data/screenings.json", "data/screenings-boston.json"];
const MIN_FRACTION = 0.5;   // a drop past this is treated as breakage, not news

const committed = path => {
  try { return JSON.parse(execFileSync("git", ["show", `HEAD:${path}`], { encoding:"utf8" })); }
  catch { return null; }    // first run, or the file is new
};
const liveVenues = d => (d.sources || []).filter(r => r.ok && !r.empty).length;
/* everything that matters, minus the timestamp that changes every run */
const substance = d => JSON.stringify({ week:d.week, screenings:d.screenings,
  sources:(d.sources||[]).map(({id,ok,count,empty,error})=>({id,ok,count,empty,error})),
  venues:d.venues, notices:d.notices });

let changed = false, failed = false;

for(const path of FILES){
  if(!existsSync(path)){ console.error(`✗ ${path} missing — the scrape did not write it`); failed = true; continue; }
  const now = JSON.parse(readFileSync(path, "utf8"));
  const was = committed(path);
  const n = now.screenings?.length ?? 0, v = liveVenues(now);

  if(n === 0){ console.error(`✗ ${path}: 0 screenings`); failed = true; continue; }

  if(was){
    const pn = was.screenings?.length ?? 0, pv = liveVenues(was);
    if(pn && n < pn * MIN_FRACTION){
      console.error(`✗ ${path}: ${n} screenings, down from ${pn} — refusing to publish`);
      failed = true; continue;
    }
    if(pv && v < pv * MIN_FRACTION){
      console.error(`✗ ${path}: ${v} live venues, down from ${pv} — refusing to publish`);
      failed = true; continue;
    }
    if(substance(now) !== substance(was)) changed = true;
    console.log(`✓ ${path}: ${n} screenings (was ${pn}), ${v} live venues (was ${pv})`);
  } else {
    changed = true;
    console.log(`✓ ${path}: ${n} screenings, ${v} live venues (nothing committed yet)`);
  }
}

if(failed){
  console.error("\nListings look broken; leaving the published schedule alone.");
  process.exit(1);
}
console.log(changed ? "\nListings changed — will commit and deploy."
                    : "\nNo change since the last run — nothing to publish.");
if(process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
