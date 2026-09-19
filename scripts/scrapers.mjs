/* One adapter per cinema. Each returns a flat list of
 *   { title, date:"YYYY-MM-DD", time:"HH:MM", fmt?, note?, url? }
 * and throws on a fetch/parse failure so run.mjs can report it.
 *
 * These are HTML scrapers against sites that can redesign at any time. Every
 * adapter is written to fail loudly (zero rows is reported as a failure) rather
 * than quietly return nothing. */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function get(url, options = {}){
  const res = await fetch(url, { ...options, signal:AbortSignal.timeout(30000), headers:{
    "User-Agent":UA,
    "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language":"en-US,en;q=0.9",
    ...options.headers
  }, redirect:"follow" });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ---------- helpers ---------- */
const strip = h => h.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const ents  = s => s.replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,"&").replace(/&quot;/g,'"')
                    .replace(/&#8217;|&rsquo;/g,"’").replace(/&#8216;|&lsquo;/g,"‘")
                    .replace(/&#8211;|&ndash;/g,"–").replace(/&#8212;|&mdash;/g,"—")
                    .replace(/&nbsp;|&#160;/g," ").replace(/&hellip;/g,"…")
                    .replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).trim();
const clean = h => ents(strip(h));
const pad   = n => String(n).padStart(2,"0");
const iso   = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

/* "7:45 PM" / "7.45pm" / "19:45" -> "HH:MM" (24h) */
function to24(raw){
  const t = String(raw).toLowerCase().replace(/\s+/g,"").replace(/\./g,":");
  let m = t.match(/^(\d{1,2}):?(\d{2})?(am|pm)$/);
  if(m){
    let h=+m[1]; const mm=m[2]||"00";
    if(m[3]==="pm" && h!==12) h+=12;
    if(m[3]==="am" && h===12) h=0;
    return `${pad(h)}:${mm}`;
  }
  m = t.match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  let h=+m[1];
  // bare clock times on a cinema schedule: 11 and 12 read as morning/noon,
  // 1-10 are evening. Film Forum and Anthology both print times this way.
  if(h>=1 && h<=10) h+=12;
  return `${pad(h)}:${m[2]}`;
}

/* epoch ms -> { date:"YYYY-MM-DD", time:"HH:MM" } in New York local time */
function nyParts(ms){
  const f = new Intl.DateTimeFormat("en-CA", { timeZone:"America/New_York",
    year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false });
  const p = Object.fromEntries(f.formatToParts(new Date(+ms)).map(x=>[x.type,x.value]));
  return { date:`${p.year}-${p.month}-${p.day}`, time:`${p.hour==="24"?"00":p.hour}:${p.minute}` };
}

const MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
/* "Sat Sep 19" / "Sat September 19" -> ISO, resolved against the current week */
function dateFromLabel(label, today){
  const m = label.match(/([a-z]{3,9})\.?\s+(\d{1,2})/i);
  if(!m) return null;
  const mo = MONTHS[m[1].slice(0,3).toLowerCase()];
  if(mo===undefined) return null;
  const day = +m[2];
  let year = today.getFullYear();
  // a month earlier than today's means it has rolled into next year
  if(mo < today.getMonth()-6) year++;
  return `${year}-${pad(mo+1)}-${pad(day)}`;
}

/* ================= FILM FORUM ================= */
/* <div id="tabs-N"><!-- 19 --> <p><strong><a>TITLE</a></strong><span>1:00</span>… */
export async function filmforum(v, ctx){
  const html = await get(v.url);
  const out = [];
  for(const tab of html.split(/<div id="tabs-\d+">/).slice(1)){
    const dm = tab.match(/<!--\s*(\d{1,2})\s*-->/);
    if(!dm) continue;
    const date = ctx.week.find(d => +d.slice(-2) === +dm[1]);
    if(!date) continue;
    for(const p of tab.split(/<p>/).slice(1)){
      const t = p.match(/<strong>\s*<a[^>]*>([\s\S]*?)<\/a>/);
      if(!t) continue;
      const title = clean(t[1]);
      for(const s of p.matchAll(/<span>\s*(\d{1,2}:\d{2})\s*(\([^)]*\))?\s*<\/span>/g)){
        const time = to24(s[1]);
        if(time) out.push({ title, date, time, note: s[2]?clean(s[2]):"" });
      }
    }
  }
  return out;
}

/* ================= IFC CENTER ================= */
/* <div class="daily-schedule …"><h3>Sat Sep 19</h3> … <ul class="times"><li><a>12:30 PM</a> */
export async function ifc(v, ctx){
  const html = await get(v.url);
  const out = [];
  for(const day of html.split(/<div class="daily-schedule /).slice(1)){
    const h = day.match(/<h3>([^<]+)<\/h3>/);
    if(!h) continue;
    const date = dateFromLabel(h[1], ctx.today);
    if(!date || !ctx.week.includes(date)) continue;
    for(const film of day.split(/<div class="details">/).slice(1)){
      const t = film.match(/<h3>\s*<a[^>]*>([\s\S]*?)<\/a>/);
      if(!t) continue;
      const title = clean(t[1]);
      const times = film.match(/<ul class="times">([\s\S]*?)<\/ul>/);
      if(!times) continue;
      for(const a of times[1].matchAll(/<a[^>]*>\s*([\d:]+\s*[APM]{2})\s*<\/a>/gi)){
        const time = to24(a[1]);
        if(time) out.push({ title, date, time });
      }
    }
  }
  return out;
}

/* ================= METROGRAPH ================= */
/* <div class="calendar-list-day …" id="calendar-list-day-YYYY-MM-DD">
 *   <h4><a class="title">…</a></h4><div class="film-metadata">Dir / 1995 / 105min / 35mm</div>
 *   <div class="showtimes"><a>8:50pm</a> */
export async function metrograph(v, ctx){
  const html = await get(v.url);
  const out = [];
  const days = html.split(/<div class="calendar-list-day[^"]*" id="calendar-list-day-/).slice(1);
  for(const day of days){
    const date = day.slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !ctx.week.includes(date)) continue;
    for(const item of day.split(/<div class="item film-thumbnail/).slice(1)){
      const t = item.match(/class="title"[^>]*>([\s\S]*?)<\/a>/);
      if(!t) continue;
      const title = clean(t[1]);
      const meta  = item.match(/<div class="film-metadata">([\s\S]*?)<\/div>/);
      const bits  = meta ? clean(meta[1]).split("/").map(x=>x.trim()) : [];
      const fmt   = bits.find(b=>/35mm|70mm|16mm|4K|DCP|digital/i.test(b)) || "";
      const year  = bits.find(b=>/^\d{4}$/.test(b));
      const runt  = bits.find(b=>/^\d+\s*min/i.test(b));
      const times = item.match(/<div class="showtimes">([\s\S]*?)<\/div>/);
      if(!times) continue;
      for(const a of times[1].matchAll(/<a[^>]*>\s*([\d:]+\s*[apm.]{2,4})\s*<\/a>/gi)){
        const time = to24(a[1]);
        if(time) out.push({ title, date, time, fmt,
          year: year?+year:undefined,
          runtime: runt?parseInt(runt,10):undefined,
          director: bits[0] && !/^\d/.test(bits[0]) ? bits[0] : undefined });
      }
    }
  }
  return out;
}

/* ================= ANTHOLOGY FILM ARCHIVES ================= */
/* month grid: <td class="calendar_day"><span class="day">2</span>
 *   <li class="calendar_event"> 6:30 PM <br/><a>TITLE</a> */
export async function anthology(v, ctx){
  const months = [...new Set(ctx.week.map(d=>d.slice(0,7)))];
  const out = [];
  for(const ym of months){
    const [y,m] = ym.split("-");
    const html = await get(`https://anthologyfilmarchives.org/film_screenings/calendar?month=${m}&year=${y}`);
    for(const cell of html.split(/<td[^>]*class="calendar_day"[^>]*>/).slice(1)){
      const d = cell.match(/<span class="day">(\d{1,2})<\/span>/);
      if(!d) continue;
      const date = `${ym}-${pad(+d[1])}`;
      if(!ctx.week.includes(date)) continue;
      for(const ev of cell.split(/<li[^>]*class="calendar_event"[^>]*>/).slice(1)){
        const tm = ev.match(/(\d{1,2}:\d{2}\s*[APM]{2})/i);
        const ti = ev.match(/<a[^>]*>([\s\S]*?)<\/a>/);
        if(!tm || !ti) continue;
        const time = to24(tm[1]);
        if(time) out.push({ title: clean(ti[1]), date, time });
      }
    }
  }
  return out;
}

/* ================= QUAD CINEMA ================= */
/* <div class="now-single-day"><h1>Sat September 19</h1>
 *   <div class="single-listing"><h4><a>TITLE</a></h4><li><a>2.30pm</a> */
export async function quad(v, ctx){
  const html = await get(v.url);
  const out = [];
  for(const day of html.split(/<div class="now-single-day">/).slice(1)){
    const h = day.match(/<h1>([^<]+)<\/h1>/);
    if(!h) continue;
    const date = dateFromLabel(h[1], ctx.today);
    if(!date || !ctx.week.includes(date)) continue;
    for(const item of day.split(/<div class="single-listing">/).slice(1)){
      const t = item.match(/<h4>\s*<a[^>]*>([\s\S]*?)<\/a>/);
      if(!t) continue;
      const title = clean(t[1]);
      for(const a of item.matchAll(/<li class="time-[^"]*">\s*<a[^>]*>\s*([\d.:]+\s*[apm]{2})\s*<\/a>/gi)){
        const time = to24(a[1]);
        if(time) out.push({ title, date, time });
      }
    }
  }
  return out;
}

/* ================= NITEHAWK (both locations) ================= */
/* per-day page; each .showtime carries data-date as a unix timestamp */
export async function nitehawk(v, ctx){
  const out = [];
  for(const date of ctx.week){
    const html = await get(`${v.url}?date=${date}`);
    for(const show of html.split(/<li class="show-container/).slice(1)){
      const t = show.match(/<div class="show-title">([\s\S]*?)<\/div>/);
      if(!t) continue;
      const title = clean(t[1]);
      for(const s of show.matchAll(/<li data-date="(\d+)"[^>]*>[\s\S]*?class="showtime[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/g)){
        const time = to24(s[2]);
        if(time) out.push({ title, date, time });
      }
    }
  }
  return out;
}

/* ================= MAYSLES ================= */
/* Squarespace serves the calendar collection as JSON; startDate is epoch ms. */
export async function maysles(v, ctx){
  const res = await fetch("https://www.maysles.org/calendar?format=json", {
    headers:{ "User-Agent":UA, "Accept":"application/json" } });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const out = [];
  for(const it of data.items || []){
    const ms = it.startDate;
    if(!ms) continue;
    const { date, time } = nyParts(ms);
    if(!ctx.week.includes(date)) continue;
    out.push({ title: ents(String(it.title||"").trim()), date, time,
               url: it.fullUrl ? `https://www.maysles.org${it.fullUrl}` : undefined });
  }
  return out;
}

/* ================= UNIONDOCS ================= */
/* The Events Calendar (Tribe) exposes a REST endpoint; start_date is NY local. */
export async function uniondocs(v, ctx){
  const url = `https://uniondocs.org/wp-json/tribe/events/v1/events`
            + `?per_page=50&start_date=${ctx.week[0]}&end_date=${ctx.week.at(-1)}`;
  const res = await fetch(url, { headers:{ "User-Agent":UA, "Accept":"application/json" } });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const out = [];
  for(const e of data.events || []){
    const m = String(e.start_date||"").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
    if(!m || !ctx.week.includes(m[1])) continue;
    out.push({ title: clean(String(e.title||"")), date:m[1], time:m[2], url:e.url });
  }
  return out;
}

/* ================= ROXY ================= */
export function parseRoxy(html, ctx){
  const out = [];
  for(const card of html.split(/<div\b[^>]*class=['"][^'"]*\bscreening__card\b[^'"]*['"][^>]*>/i).slice(1)){
    const t = card.match(/<h3\b[^>]*>[\s\S]*?<a\b[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i);
    const d = card.match(/<p\b[^>]*class=['"]screening__date['"][^>]*>\s*(\d{2})\.(\d{2})\.(\d{4})\s*\|\s*([^<]+)/i);
    if(!t || !d) continue;
    const date = `${d[3]}-${d[1]}-${d[2]}`, time = to24(clean(d[4]));
    if(!ctx.week.includes(date) || !time) continue;
    const [title, ...notes] = clean(t[2]).split(/\s+\|\s+/);
    out.push({title, date, time, url:ents(t[1]), note:notes.join(' | '),
      fmt:title.match(/\b(?:35|70|16)mm\b/i)?.[0] || ''});
  }
  return out;
}
export async function roxy(v, ctx){ return parseRoxy(await get(v.url), ctx); }

/* ================= SYNDICATED / VEEZI ================= */
export function parseVeezi(html, ctx){
  const out = [];
  // The page repeats the schedule in date and film views. Read only the date view.
  const byDate = html.split(/id="sessionsByFilmConent"/)[0];
  for(const film of byDate.split(/<div\s+class="film\s*[^"]*"/).slice(1)){
    const title = film.match(/<h3 class="title">([\s\S]*?)<\/h3>/)?.[1];
    if(!title) continue;
    for(const group of film.split(/<div class="date-container">/).slice(1)){
      const label = group.match(/<h4 class="date">\w+\s+(\d{1,2}),\s*(\w+)<\/h4>/);
      if(!label) continue;
      const date = dateFromLabel(`${label[2]} ${label[1]}`, ctx.today);
      if(!ctx.week.includes(date)) continue;
      for(const li of group.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)){
        const raw = li[1].match(/<time>([^<]+)<\/time>/)?.[1];
        const time = raw && to24(raw);
        if(!time) continue;
        out.push({title:clean(title), date, time,
          url:ents(li[1].match(/href="([^"]+)"/)?.[1] || ''),
          note:/SOLD OUT/.test(li[1]) ? 'Sold out' : /BOOKINGS CLOSED/.test(li[1]) ? 'Bookings closed' : ''});
      }
    }
  }
  return out;
}
export async function syndicated(v, ctx){ return parseVeezi(await get(v.scheduleUrl), ctx); }

/* ================= BAM ================= */
export function parseBam(data, ctx){
  if(!Array.isArray(data)) throw new Error('BAM calendar response is not an array');
  const out = [];
  for(const film of data){
    if(film.genres !== 'Film') continue;
    for(const stamp of film.performances || []){
      const ms = Date.parse(stamp);
      if(!Number.isFinite(ms)) throw new Error('BAM returned an invalid performance date');
      const {date,time} = nyParts(ms);
      if(ctx.week.includes(date)) out.push({title:clean(film.name), date, time,
        url:new URL(film.moreLink, 'https://www.bam.org').href});
    }
  }
  return out;
}
export async function bam(v, ctx){
  const usDate = d => `${d.slice(5,7)}/${d.slice(8,10)}/${d.slice(0,4)}`;
  // Match the widget URL exactly: the server can return XML for encoded slashes.
  const params = `start=${usDate(ctx.week[0])}&end=${usDate(ctx.week.at(-1))}`;
  return parseBam(JSON.parse(await get(`https://www.bam.org/api/BAMApi/GetCalendarEventsByDayWithOnGoing?${params}`, {headers:{Accept:"application/json"}})), ctx);
}

/* ================= CINEMA VILLAGE ================= */
export function parseCinemaVillageListings(html, ctx){
  const dates = new Map();
  for(const link of html.matchAll(/<a\b[^>]*href="#tab_default_(\d+)"[^>]*>([\s\S]*?)<\/a>/g)){
    const md = clean(link[2]).match(/(\d{2})\.(\d{2})/);
    if(md) dates.set(link[1], ctx.week.find(d=>d.slice(5)===`${md[1]}-${md[2]}`));
  }
  const out = [];
  for(const tab of html.split(/<div\b[^>]*class="tab-pane[^"]*"\s+id="tab_default_/).slice(1)){
    const date = dates.get(tab.match(/^(\d+)/)?.[1]);
    if(!date) continue;
    for(const li of tab.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)){
      const title = li[1].match(/class="ttl"[^>]*>([\s\S]*?)<\/a>/)?.[1];
      const id = li[1].match(/id="container-for-ticketsid-\d+-([^"<>]+)"/)?.[1];
      if(title && id) out.push({title:clean(title),movieId:id,date});
    }
  }
  return out;
}
export function parseCinemaVillageTimes(data, film, ctx){
  if(data.type !== 'success' || typeof data.msg !== 'string') throw new Error('Cinema Village returned an invalid times response');
  const out = [];
  for(const a of data.msg.matchAll(/<a\b[^>]*rel="([^"|]+)\|(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\|[^"|]+"[^>]*>/g)){
    const date = `${a[2]}-${a[3]}-${a[4]}`;
    if(a[1]!==film.movieId || date!==film.date || !ctx.week.includes(date)) continue;
    out.push({title:film.title,date,time:`${a[5]}:${a[6]}`,url:'https://www.cinemavillage.com/showtimes/'});
  }
  return out;
}
export async function cinemaVillage(v, ctx){
  const films = parseCinemaVillageListings(await get(`${v.url}showtimes/`), ctx);
  if(!films.length) throw new Error('Cinema Village has no dated film listings in range');
  const out = [];
  // Small batches avoid hammering the venue's server.
  for(let i=0;i<films.length;i+=3){
    const rows = await Promise.all(films.slice(i,i+3).map(async film => {
      const data = JSON.parse(await get(`${v.url}managemovies.html`, {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({do:'movietimes',m:film.movieId,d:film.date}).toString()
      }));
      return parseCinemaVillageTimes(data, film, ctx);
    }));
    out.push(...rows.flat());
  }
  return out;
}

/* ================= ANGELIKA ================= */
export function parseAngelika(data, ctx){
  const result = data.nowShowing;
  if(result?.statusCode!==200 || !Array.isArray(result.data?.movies)) throw new Error('Angelika returned an invalid showtimes response');
  const out = [];
  for(const film of result.data.movies){
    if(film.theater !== '0000000005') continue;
    for(const day of film.showdates || []) for(const type of day.showtypes || []) for(const show of type.showtimes || []){
      // The API uses ISO offsets shortened to -04; normalize before parsing.
      const ms = Date.parse(String(show.date_time).replace(/([+-]\d{2})$/, '$1:00'));
      if(!Number.isFinite(ms)) throw new Error('Angelika returned an invalid performance date');
      const {date,time} = nyParts(ms);
      if(!ctx.week.includes(date)) continue;
      out.push({title:clean(film.name),date,time,fmt:type.type || '',
        director:clean(film.director || ''),runtime:Number(film.length) || undefined,
        note:show.soldout ? 'Sold out' : '',
        url:`https://www.angelikafilmcenter.com/nyc/movies/details/${encodeURIComponent(film.movieSlug)}`});
    }
  }
  return out;
}
export async function angelika(v, ctx){
  const base = 'https://production-api.readingcinemas.com';
  // This is the site's anonymous browsing token, issued without a user account.
  const settings = JSON.parse(await get(`${base}/settings/6`));
  const token = settings.data?.settings?.token;
  if(!token) throw new Error('Angelika did not issue an anonymous browsing token');
  const out = [];
  for(const date of ctx.week){
    const q = new URLSearchParams({countryId:'6',cinemaId:'0000000005',status:'getShows',flag:'nowshowing',selectedDate:date});
    out.push(...parseAngelika(JSON.parse(await get(`${base}/films?${q}`, {headers:{Authorization:`Bearer ${token}`}})), ctx));
  }
  return out;
}

/* ================= PARIS ================= */
export function parseParis(data, ctx){
  if(!Array.isArray(data.showtimes) || !Array.isArray(data.relatedData?.films)) throw new Error('Paris returned an invalid showtimes response');
  const films = new Map(data.relatedData.films.map(f=>[f.id,f]));
  const attrs = new Map((data.relatedData.attributes || []).map(a=>[a.id,a.shortName?.text || a.name?.text || '']));
  const out = [];
  for(const show of data.showtimes){
    if(show.siteId !== '2001') continue;
    const film = films.get(show.filmId);
    if(!film) throw new Error('Paris showtime is missing its film metadata');
    const ms = Date.parse(show.schedule?.startsAt);
    if(!Number.isFinite(ms)) throw new Error('Paris returned an invalid performance date');
    const {date,time} = nyParts(ms);
    if(!ctx.week.includes(date)) continue;
    out.push({title:clean(film.title.text),date,time,runtime:film.runtimeInMinutes,
      fmt:(show.attributeIds || []).map(id=>attrs.get(id)).filter(Boolean).join(', '),
      note:show.isSoldOut ? 'Sold out' : '',
      url:`https://tickets.paristheaternyc.com/order/showtimes/${encodeURIComponent(show.id)}/seats`});
  }
  return out;
}
export async function paris(v, ctx){
  // Follow the public website's anonymous browsing flow. Discover its current
  // published client configuration at runtime; never commit credentials/tokens.
  const html = await get(v.url);
  const layout = html.match(/static\/chunks\/app\/layout-[a-z0-9]+\.js/)?.[0];
  if(!layout) throw new Error('Paris browsing configuration script was not found');
  const script = await get(new URL(`/_next/${layout}`,v.url).href);
  const form = new URLSearchParams({grant_type:'password'});
  for(const key of ['username','password','client_id']){
    const value = script.match(new RegExp(`\\.append\\("${key}",""\\.concat\\("([^"\\\\]+)"\\)\\)`))?.[1];
    if(!value) throw new Error('Paris anonymous browsing configuration changed');
    form.set(key,value);
  }
  const auth = JSON.parse(await get('https://auth.moviexchange.com/connect/token', {
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()
  }));
  if(!auth.access_token) throw new Error('Paris did not issue an anonymous browsing token');
  const out = [];
  for(const date of ctx.week){
    const data = JSON.parse(await get(`https://digital-api.paristheaternyc.com/ocapi/v1/showtimes/by-business-date/${date}?siteIds=2001`, {
      headers:{Authorization:`Bearer ${auth.access_token}`}
    }));
    out.push(...parseParis(data,ctx));
  }
  return out;
}
