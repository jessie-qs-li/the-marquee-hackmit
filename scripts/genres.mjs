import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTMDBLookup} from './tmdb.mjs';

// Ten browsing categories; source labels remain on each screening for traceability.
const GROUPS={History:'drama','Science Fiction':'scifi',Family:'family',Music:'comedy',Drama:'drama',War:'drama',Comedy:'comedy',Musical:'comedy',Thriller:'thriller',Mystery:'thriller',Crime:'thriller','Film-Noir':'thriller',Horror:'horror','Sci-Fi':'scifi',Fantasy:'scifi',Documentary:'documentary',Action:'action',Western:'action',Adventure:'adventure',Romance:'romance',Animation:'family',Children:'family'};
export function mapGenres(values=[]){return [...new Set(values.map(x=>GROUPS[x]||(['drama','comedy','thriller','horror','scifi','documentary','action','adventure','romance','family'].includes(x)?x:null)).filter(Boolean))];}
export function parseCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw new Error('Unterminated CSV quote');if(field||row.length){row.push(field);rows.push(row);}const header=rows.shift();return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h.replace(/^\uFEFF/,''),r[i]||''])));
}
export function cleanTitle(t){return String(t).replace(/\s*\((?:open captioning|early access|oc)\)/gi,'').replace(/\s*(?:[-–—]|\bin)\s*(?:35|70|16)mm\b.*$/i,'').replace(/\s*\+\s*(?:q&a|introduction|learning from).*$/i,'').replace(/\s*\(\d{4}\)\s*$/,'').trim();}
export function titleKey(t){return cleanTitle(t).replace(/,\s*(The|A|An)$/i,'').replace(/^(the|a|an)\s+/i,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
export function buildIndex(movies){
 const index=new Map();
 for(const movie of movies){const title=movie.title.replace(/\s*\(\d{4}\)\s*$/,'');movie.year=Number(movie.title.match(/\((\d{4})\)\s*$/)?.[1])||null;
 const aliases=[title,title.replace(/\s*\([^)]*\)/g,'').trim(),...[...title.matchAll(/\(([^)]+)\)/g)].map(m=>m[1].replace(/^a\.k\.a\.\s*/i,''))];
 for(const alias of aliases){const key=titleKey(alias);if(!key)continue;const list=index.get(key)||[];if(!list.includes(movie))list.push(movie);index.set(key,list);}
 }return index;
}
export function selectMatch(row,index){
 const candidates=index.get(titleKey(row.title))||[];
 const year=Number(row.year)||Number(row.title.match(/\((\d{4})\)\s*$/)?.[1]);
 const matches=year?candidates.filter(m=>m.year===year):candidates;
 return matches.length===1?matches[0]:null;
}
export async function enrichGenres(rows,{root,token=process.env.TMDB_READ_TOKEN,fetcher=fetch}={}){
 const tmdb=createTMDBLookup({root,token,fetcher,normalize:titleKey,clean:cleanTitle});
 const index=buildIndex(parseCSV(readFileSync(resolve(root,'data/movies.csv'),'utf8')));
 const path=resolve(root,'data/genre-overrides.json');const overrides=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
 const groups=new Map();for(const row of rows){const key=titleKey(row.title)+'|'+(row.year||'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 const unresolved=[];
 for(const [key,group] of groups){const row=group[0];const match=selectMatch(row,index);let raw=overrides[key]||overrides[titleKey(row.title)];let source='editorial';
 if(!raw){raw=group.filter(r=>r.genreSource==='venue'||!r.genreSource).flatMap(r=>r.sourceGenres||r.genres||[]);source='venue';}
 if(!mapGenres(raw).length&&match){raw=match.genres.split('|');source='movies.csv';}
 let tmdbMatch=null;
 if(!mapGenres(raw||[]).length){tmdbMatch=await tmdb.lookup(row);if(tmdbMatch?.status==='matched'){raw=tmdbMatch.genres;source='tmdb';}}
 const genres=mapGenres(raw||[]);
 if(!genres.length){source='unclassified';unresolved.push({key,title:row.title,year:row.year||null,reason:tmdbMatch?.status||'not in catalogue or ambiguous title'});}
 for(const r of group){r.genres=genres;r.sourceGenres=raw||[];r.genreSource=source;delete r.tmdbId;if(source==='tmdb')r.tmdbId=tmdbMatch.id;if(source==='movies.csv')r.genreMovieId=match.movieId;else delete r.genreMovieId;}
 }
 return {total:groups.size,classified:groups.size-unresolved.length,unresolved,tmdbRequests:tmdb.requests,errors:tmdb.errors};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('../',import.meta.url));
 for(const filename of (process.argv.slice(2).length?process.argv.slice(2):['data/screenings.json','data/screenings-boston.json'])){
  const path=resolve(root,filename);if(!existsSync(path))continue;const data=JSON.parse(readFileSync(path,'utf8'));data.genreCoverage=await enrichGenres(data.screenings,{root});writeFileSync(path,JSON.stringify(data,null,1)+'\n');console.log(`${filename}: ${data.genreCoverage.classified}/${data.genreCoverage.total} titles classified`);
 }
}
