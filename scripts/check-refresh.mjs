#!/usr/bin/env node
/* Gate between scraping and publishing.
 *
 * An unattended hourly job must never replace a good schedule with a broken
 * one: a network blip, a site redesign or a new bot wall would otherwise empty
 * the live board. This compares what was just scraped against what is already
 * committed and holds back anything that looks collapsed.
 *
 * The verdict is per city. One city losing its venues to a bad network minute
 * should not throw away another city's good scrape, so each file is judged on
 * its own and only the ones that pass are published; the rest keep their last
 * good copy. The run only fails when every city is broken.
 *
 * It also reports whether anything actually changed, ignoring the fetchedAt
 * stamp, so a quiet hour produces no commit and no deploy.
 *
 *   node scripts/check-refresh.mjs            # writes changed=…, publish=… to $GITHUB_OUTPUT
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

let changed = false;
const publish = [], held = [];

for(const path of FILES){
  const hold = reason => { console.error(`✗ ${path}: ${reason}`); held.push(path); };

  if(!existsSync(path)){ hold("missing — the scrape did not write it"); continue; }
  const now = JSON.parse(readFileSync(path, "utf8"));
  const was = committed(path);
  const n = now.screenings?.length ?? 0, v = liveVenues(now);

  if(n === 0){ hold("0 screenings"); continue; }

  if(was){
    const pn = was.screenings?.length ?? 0, pv = liveVenues(was);
    if(pn && n < pn * MIN_FRACTION){ hold(`${n} screenings, down from ${pn}`); continue; }
    if(pv && v < pv * MIN_FRACTION){ hold(`${v} live venues, down from ${pv}`); continue; }
    if(substance(now) !== substance(was)) changed = true;
    console.log(`✓ ${path}: ${n} screenings (was ${pn}), ${v} live venues (was ${pv})`);
  } else {
    changed = true;
    console.log(`✓ ${path}: ${n} screenings, ${v} live venues (nothing committed yet)`);
  }
  publish.push(path);
}

if(!publish.length){
  console.error("\nEvery city looks broken; leaving the published schedule alone.");
  process.exit(1);
}

if(held.length){
  /* an annotation rather than a failure: the cities that did pass still publish,
     and the held ones keep serving their last good copy */
  const msg = `Held back ${held.join(", ")} — keeping the last good copy. The other cities published.`;
  console.error(`\n${msg}`);
  if(process.env.GITHUB_ACTIONS) console.log(`::warning title=Listings held back::${msg}`);
}

console.log(changed ? "\nListings changed — will commit and deploy."
                    : "\nNo change since the last run — nothing to publish.");
if(process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
  `changed=${changed}\npublish=${publish.join(" ")}\n`);
