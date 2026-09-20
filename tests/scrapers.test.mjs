import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoxy,parseVeezi,parseBam,parseCinemaVillageListings,parseCinemaVillageTimes,parseAngelika,parseParis,parseHFA,parseLandmark} from '../scripts/scrapers.mjs';
const ctx={today:new Date(2026,8,19),week:['2026-09-19','2026-09-20']};

test('Roxy pairs each title with its date, decodes entities, and keeps series notes separate',()=>{
 const card=(date,title)=>`<div class='screening__card js-link' data-datetime='${date}'><h3 class='screening__title'><a href="https://www.roxycinemanewyork.com/screenings/test/">${title}</a></h3><p class='screening__date'>${date} | 12:00PM</p></div>`;
 const rows=parseRoxy(card('09.19.2026','Titane | Sex, Death, Cars!')+card('09.20.2026','Who&#39;s Watching + Q&amp;A')+card('09.21.2026','Later'),ctx);
 assert.equal(rows.length,2);assert.equal(rows[0].title,'Titane');assert.equal(rows[0].note,'Sex, Death, Cars!');assert.equal(rows[0].time,'12:00');assert.equal(rows[1].title,"Who's Watching + Q&A");
});

test('Veezi handles midnight, sold out sessions, year rollover and duplicated alternate view',()=>{
 const film=`<div class="film "><h3 class="title">Crash (1996)</h3><div class="date-container"><h4 class="date">Friday 1, January</h4><ul><li><a class="sold-out-session"><time>12:05 AM</time></a><span>SOLD OUT</span></li></ul></div></div>`;
 const rows=parseVeezi(`<div id="sessionsByDateConent">${film}</div><div id="sessionsByFilmConent">${film}</div>`,{today:new Date(2026,11,31),week:['2027-01-01']});
 assert.equal(rows.length,1);assert.equal(rows[0].date,'2027-01-01');assert.equal(rows[0].time,'00:05');assert.equal(rows[0].note,'Sold out');
});

test('BAM filters non-film events and converts offset times into New York dates',()=>{
 const film={genres:'Film',name:'A &amp; B',moreLink:'/film/test',performances:['2026-09-20T02:30:00Z','2026-09-22T18:00:00-04:00']};
 const rows=parseBam([film,{...film,genres:'Music'}],ctx);
 assert.deepEqual(rows,[{title:'A & B',date:'2026-09-19',time:'22:30',url:'https://www.bam.org/film/test'}]);assert.throws(()=>parseBam({},ctx));
});

test('Cinema Village binds film IDs to dated tabs and rejects mismatched sessions',()=>{
 const html=`<a href="#tab_default_0"><span>Sat</span>09.19</a><a href="#tab_default_1"><span>Mon</span>09.21</a><div class="tab-pane active" id="tab_default_0"><li><a class="ttl">THE INVITE</a><div id="container-for-ticketsid-0-RS1"></div></li></div><div class="tab-pane" id="tab_default_1"><li><a class="ttl">LATER</a><div id="container-for-ticketsid-1-RS2"></div></li></div>`;
 const films=parseCinemaVillageListings(html,ctx);assert.deepEqual(films,[{title:'THE INVITE',movieId:'RS1',date:'2026-09-19'}]);
 const data={type:'success',msg:'<a rel="RS1|202609191400|1"><span>2:00PM</span></a><a rel="RS2|202609191600|2"></a><a rel="RS1|202609201800|3"></a>'};
 const rows=parseCinemaVillageTimes(data,films[0],ctx);assert.equal(rows.length,1);assert.equal(rows[0].time,'14:00');assert.throws(()=>parseCinemaVillageTimes({type:'error'},films[0],ctx));
});

test('Angelika uses session dates, normalizes short timezone offsets and isolates NYC',()=>{
 const film={theater:'0000000005',name:'TEST',movieSlug:'test',length:'112',showdates:[{date:'2026-09-19',showtypes:[{type:'35mm',showtimes:[{date_time:'2026-09-20T00:15:00-04',soldout:true}]}]}]};
 const rows=parseAngelika({nowShowing:{statusCode:200,data:{movies:[film,{...film,theater:'OTHER'}]}}},ctx);
 assert.equal(rows.length,1);assert.equal(rows[0].date,'2026-09-20');assert.equal(rows[0].time,'00:15');assert.equal(rows[0].fmt,'35mm');assert.equal(rows[0].note,'Sold out');assert.throws(()=>parseAngelika({message:'Unauthorized'},ctx));
});

test('Paris joins film metadata and format by ID and uses actual start date after midnight',()=>{
 const data={showtimes:[{id:'2001-1',siteId:'2001',filmId:'f1',schedule:{businessDate:'2026-09-19',startsAt:'2026-09-20T00:15:00-04:00'},attributeIds:['a1']}],relatedData:{films:[{id:'f1',title:{text:'Babylon'},runtimeInMinutes:189}],attributes:[{id:'a1',shortName:{text:'70MM'}}]}};
 const rows=parseParis(data,ctx);assert.equal(rows[0].title,'Babylon');assert.equal(rows[0].date,'2026-09-20');assert.equal(rows[0].fmt,'70MM');assert.match(rows[0].url,/2001-1\/seats$/);assert.throws(()=>parseParis({...data,relatedData:{films:[]}},ctx));
});

import {parseBrattle,parseCoolidge} from '../scripts/scrapers.mjs';
test('Brattle uses the requested HTML day instead of stale homepage JSONLD',()=>{
 const html='<div class="show" style="x"><a href="https://brattlefilm.org/movies/test/"><h2>A &amp; B</h2></a><ol class="showtimes"><li><a href="https://brattlefilm.org/purchase/1/" class="showtime">7:00 pm</a></li></ol>';
 const rows=parseBrattle(html,ctx,'2026-09-21');assert.equal(rows[0].date,'2026-09-21');assert.equal(rows[0].time,'19:00');assert.equal(rows[0].title,'A & B');
});
test('Coolidge keeps each film and ticket URL paired and decodes nested entities',()=>{
 const html='<div class="film-card"><h2><a class="film-card__link" href="/films/test">Test</a></h2><a href="https://store.coolidge.org/ticket?x=1&amp;amp;y=2" class="showtime-ticket__button"><span class="showtime-ticket__time">12:05am</span></a>';
 const rows=parseCoolidge(html,'2026-09-20');assert.equal(rows[0].time,'00:05');assert.equal(rows[0].url,'https://store.coolidge.org/ticket?x=1&y=2');
});

test('Harvard Film Archive reads the machine datetime and keeps the series as a note',()=>{
 const ev=(dt,title,series)=>`<div class="grid-3 m-calendar__spot--event event"><a href="/calendar/x" class="event__link"></a><div class="event__series">${series} ...</div><div class="event__time"><time datetime="${dt}"><span>2:00 pm</span></time></div><h5 class="event__title">${title}</h5></div>`;
 const rows=parseHFA(ev('2026-09-19 14:00:00','Cabaret','Nostalgia')+ev('2026-09-28 19:00:00','Later','Other'),ctx);
 assert.equal(rows.length,1);
 assert.equal(rows[0].title,'Cabaret');
 assert.equal(rows[0].date,'2026-09-19');
 assert.equal(rows[0].time,'14:00');
 assert.equal(rows[0].note,'Nostalgia');
 assert.equal(rows[0].url,'https://harvardfilmarchive.org/calendar/x');
});

test('Landmark joins schedule ids to titles, filters to the week and reads print format',()=>{
 const schedule={'314882':{'2026-09-19':[{startsAt:'2026-09-19T12:50:00',tags:['Format.Projection.70mm']},{startsAt:'2026-09-19T21:05:00',tags:[]}],'2026-10-01':[{startsAt:'2026-10-01T12:00:00'}]},'99':{'2026-09-20':[{startsAt:'2026-09-20T18:00:00'}]}};
 const rows=parseLandmark(schedule,{'314882':'Sirat'},ctx);
 assert.equal(rows.length,2);                    // unknown id 99 is dropped, October is out of range
 assert.deepEqual(rows.map(r=>r.time),['12:50','21:05']);
 assert.equal(rows[0].fmt,'70mm');
 assert.equal(rows[1].fmt,'');
});
