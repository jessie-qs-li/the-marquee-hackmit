/* The 20 New York cinemas The Marquee indexes.
 *
 * `scrape` names the adapter in scrapers.mjs. A venue with scrape:null is
 * listed on the board but has no working adapter yet -- `blocked` says why,
 * so it shows up in the run report instead of silently producing nothing. */
export const VENUES = [
  { id:"ff",      name:"Film Forum",            sn:"Film Forum",        hood:"West Village",      boro:"Manhattan", kind:"indie", price:1800,
    about:"Indie premieres, documentaries, restorations, repertory.",
    url:"https://filmforum.org/now_playing", scrape:"filmforum" },

  { id:"mg",      name:"Metrograph",            sn:"Metrograph",        hood:"Lower East Side",   boro:"Manhattan", kind:"indie", price:1700,
    about:"Highly curated repertory, 35mm, international films; a great date-night cinema.",
    url:"https://metrograph.com/nyc/", scrape:"metrograph" },

  { id:"ifc",     name:"IFC Center",            sn:"IFC Center",        hood:"Greenwich Village", boro:"Manhattan", kind:"indie", price:1800,
    about:"Indie releases, documentaries, cult and midnight screenings.",
    url:"https://www.ifccenter.com/", scrape:"ifc" },

  { id:"afa",     name:"Anthology Film Archives", sn:"Anthology",       hood:"East Village",      boro:"Manhattan", kind:"indie", price:1300,
    about:"Experimental, avant-garde and underground cinema.",
    url:"https://anthologyfilmarchives.org/film_screenings/calendar", scrape:"anthology" },

  { id:"quad",    name:"Quad Cinema",           sn:"Quad Cinema",       hood:"Greenwich Village", boro:"Manhattan", kind:"indie", price:1700,
    about:"First-run arthouse plus international and repertory programming.",
    url:"https://quadcinema.com/all/", scrape:"quad" },

  { id:"cv",      name:"Cinema Village",        sn:"Cinema Village",    hood:"Greenwich Village", boro:"Manhattan", kind:"indie", price:1500,
    about:"Old-school neighborhood indie theater.",
    url:"https://www.cinemavillage.com/", scrape:null,
    blocked:"Showtimes are injected client-side; the served HTML has no times." },

  { id:"roxy",    name:"Roxy Cinema New York",  sn:"Roxy Cinema",       hood:"Tribeca",           boro:"Manhattan", kind:"indie", price:1500,
    about:"35mm, cult films, rare prints and indie releases.",
    url:"https://www.roxycinemanewyork.com/", scrape:null,
    blocked:"Squarespace site renders its schedule in JS; no showtimes in the HTML." },

  { id:"angelika",name:"Angelika Film Center",  sn:"Angelika",          hood:"SoHo",              boro:"Manhattan", kind:"indie", price:1900,
    about:"One of NYC's classic first-run indie and foreign-film venues.",
    url:"https://www.angelikafilmcenter.com/nyc", scrape:null,
    blocked:"Single-page app; listings come from an authenticated internal API." },

  { id:"paris",   name:"The Paris Theater",     sn:"Paris Theater",     hood:"Midtown",           boro:"Manhattan", kind:"indie", price:1700,
    about:"Historic single-screen arthouse, now operated by Netflix.",
    url:"https://www.theparistheater.com/", scrape:null,
    blocked:"Schedule is rendered client-side; served HTML carries no showtimes." },

  { id:"wrt",     name:"Walter Reade Theater",  sn:"Walter Reade",      hood:"Lincoln Center",    boro:"Manhattan", kind:"indie", price:1700,
    about:"Film at Lincoln Center: international, festival and repertory cinema.",
    url:"https://www.filmlinc.org/calendar/", scrape:null,
    blocked:"filmlinc.org returns 403 to scripted requests (bot protection)." },

  { id:"ebm",     name:"Elinor Bunin Munroe Film Center", sn:"Elinor Bunin", hood:"Lincoln Center", boro:"Manhattan", kind:"indie", price:1700,
    about:"Film at Lincoln Center: contemporary arthouse and international cinema.",
    url:"https://www.filmlinc.org/calendar/", scrape:null,
    blocked:"filmlinc.org returns 403 to scripted requests (bot protection)." },

  { id:"bam",     name:"BAM Rose Cinemas",      sn:"BAM Rose",          hood:"Fort Greene",       boro:"Brooklyn",  kind:"indie", price:1700,
    about:"Indie, international, repertory and festival programming.",
    url:"https://www.bam.org/film", scrape:null,
    blocked:"Listings load from a JSON API behind the page; no stable public endpoint found." },

  { id:"nhw",     name:"Nitehawk Williamsburg", sn:"Nitehawk W'burg",   hood:"Williamsburg",      boro:"Brooklyn",  kind:"indie", price:1600,
    about:"Indie and repertory programming with food and drinks.",
    url:"https://nitehawkcinema.com/williamsburg/", scrape:"nitehawk" },

  { id:"nhp",     name:"Nitehawk Prospect Park",sn:"Nitehawk Prospect", hood:"Park Slope",        boro:"Brooklyn",  kind:"indie", price:1600,
    about:"The larger Nitehawk, with similarly strong programming.",
    url:"https://nitehawkcinema.com/prospectpark/", scrape:"nitehawk" },

  { id:"spec",    name:"Spectacle",             sn:"Spectacle",         hood:"Williamsburg",      boro:"Brooklyn",  kind:"indie", price:500,
    about:"Tiny volunteer-run microcinema; underground, obscure, experimental and cult.",
    url:"https://www.spectacletheater.com/", scrape:null,
    blocked:"Calendar is a JS widget; the served HTML lists no showtimes." },

  { id:"synd",    name:"Syndicated",            sn:"Syndicated",        hood:"Bushwick",          boro:"Brooklyn",  kind:"indie", price:400,
    about:"Cinema and bar with cult, repertory and genre programming.",
    url:"https://syndicatedbk.com/", scrape:null,
    blocked:"No listings path found that returns showtimes in HTML." },

  { id:"momi",    name:"Museum of the Moving Image", sn:"MOMI",         hood:"Astoria",           boro:"Queens",    kind:"indie", price:1500,
    about:"Museum cinema with excellent retrospectives and special screenings.",
    url:"https://movingimage.org/calendar/", scrape:null,
    blocked:"movingimage.org returns 403 to scripted requests (bot protection)." },

  { id:"maysles", name:"Maysles Documentary Center", sn:"Maysles",      hood:"Harlem",            boro:"Manhattan", kind:"indie", price:1000,
    about:"Especially strong for documentary and socially engaged cinema.",
    url:"https://www.maysles.org/calendar", scrape:"maysles", allowEmpty:true },

  { id:"kew",     name:"Kew Gardens Cinema",    sn:"Kew Gardens",       hood:"Kew Gardens",       boro:"Queens",    kind:"indie", price:1400,
    about:"Neighborhood arthouse cinema.",
    url:"https://kewgardenscinemas.com/", scrape:null,
    blocked:"Host does not respond to requests from here (connection times out)." },

  { id:"udocs",   name:"UnionDocs",             sn:"UnionDocs",         hood:"Ridgewood",         boro:"Queens",    kind:"indie", price:1200,
    about:"Documentary, experimental work, artist talks and unconventional screenings.",
    url:"https://uniondocs.org/events/", scrape:"uniondocs", allowEmpty:true }
];
