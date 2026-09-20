// Boston includes nearby independent cinemas in Greater Boston.
export const BOSTON_VENUES=[
 {id:'brattle',name:'Brattle Theatre',sn:'Brattle',hood:'Harvard Square',boro:'Cambridge',kind:'indie',price:1550,about:'Repertory and independent cinema in Harvard Square.',url:'https://brattlefilm.org/',scrape:'brattle'},
 {id:'coolidge',name:'Coolidge Corner Theatre',sn:'Coolidge Corner',hood:'Coolidge Corner',boro:'Brookline',kind:'indie',price:0,about:'Independent releases, repertory and special screenings. Check the venue for ticket prices.',url:'https://coolidge.org/showtimes',scrape:'coolidge'},

 {id:'somerville',name:'Somerville Theatre',sn:'Somerville',hood:'Davis Square',boro:'Somerville',kind:'indie',price:0,
  about:'A 1914 movie palace known for 35mm and 70mm projection, live events and local film festivals.',
  url:'https://www.somervilletheatre.com/movies/',scrape:null,
  blocked:'somervilletheatre.com returns 403 to scripted requests; the page loads normally in a real browser, so this needs a headless browser.'},

 {id:'kendall',name:'Landmark Kendall Square Cinema',sn:'Kendall Square',hood:'Kendall Square',boro:'Cambridge',kind:'indie',price:0,
  about:'Multi-screen arthouse hub for new indie releases, documentaries and foreign films.',
  url:'https://www.landmarktheatres.com/boston/kendall-square-cinema',scrape:'landmark',theaterId:'X019B'},

 {id:'hfa',name:'Harvard Film Archive',sn:'Harvard Film Archive',hood:'Harvard Square',boro:'Cambridge',kind:'indie',price:1200,
  about:"Cinematheque in Harvard's Carpenter Center: rare international films, experimental work and preserved prints.",
  url:'https://harvardfilmarchive.org/calendar',scrape:'hfa'},

 {id:'mfa',name:'Museum of Fine Arts',sn:'MFA Film',hood:'Fenway',boro:'Boston',kind:'indie',price:0,
  about:'The museum auditorium screens curated international films, indie documentaries and restored classics.',
  url:'https://www.mfa.org/programs/film',scrape:null,
  blocked:'The programs calendar lists only a couple of film entries and carries date ranges rather than showtimes; per-screening times are not in any page found.'}
];
