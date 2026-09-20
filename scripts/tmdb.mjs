import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';

export function selectTMDBMatch(row,results,normalize){
 const year=Number(row.year)||Number(row.title.match(/\((\d{4})\)\s*$/)?.[1]);
 const candidates=results.filter(m=>[m.title,m.original_title].filter(Boolean).some(t=>normalize(t)===normalize(row.title))&&(!year||Number((m.release_date||'').slice(0,4))===year));
 return candidates.length===1?candidates[0]:null;
}
export function createTMDBLookup({root,normalize,clean,token=process.env.TMDB_READ_TOKEN,fetcher=fetch,now=()=>Date.now()}){
 const path=resolve(root,'data/tmdb-cache.json');
 const cache=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{version:1,movies:{}};
 let stopped=false;const errors=[];let requests=0;
 const save=()=>{writeFileSync(path+'.tmp',JSON.stringify(cache,null,2)+'\n');renameSync(path+'.tmp',path);};
 async function api(pathname,params={}){
  const url=new URL('https://api.themoviedb.org/3/'+pathname);for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
  requests++;
  const res=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new Error(`TMDB HTTP ${res.status}`);
  return res.json();
 }
 async function lookup(row){
  const year=Number(row.year)||Number(row.title.match(/\((\d{4})\)\s*$/)?.[1])||'';
  const key=normalize(row.title)+'|'+year;const hit=cache.movies[key];
  // Successful metadata is reusable indefinitely; review failed matches weekly.
  if(hit&&(hit.status==='matched'||now()-Date.parse(hit.checkedAt)<7*86400000))return hit;
  if(!token||stopped)return hit||null;
  try{
   if(!cache.genres){cache.genres=(await api('genre/movie/list')).genres;save();}
   const params={query:clean(row.title),include_adult:'false'};if(year)params.primary_release_year=year;
   const data=await api('search/movie',params);
   // Check every returned page before accepting a supposedly unique title.
   const results=[...(data.results||[])];
   if(data.total_pages>5){const entry={status:'ambiguous',checkedAt:new Date(now()).toISOString()};cache.movies[key]=entry;save();return entry;}
   for(let page=2;page<=(data.total_pages||1);page++)results.push(...(await api('search/movie',{...params,page})).results);
   const match=selectTMDBMatch(row,results,normalize);
   const genres=match?(match.genre_ids||[]).map(id=>cache.genres.find(g=>g.id===id)?.name).filter(Boolean):[];
   const entry={status:match&&genres.length?'matched':match?'no-genres':results.length?'ambiguous':'not-found',checkedAt:new Date(now()).toISOString(),...(match?{id:match.id,title:match.title,year:match.release_date?.slice(0,4)||null,genres}:{} )};
   cache.movies[key]=entry;save();return entry;
  }catch(err){stopped=true;errors.push(err.message.startsWith('TMDB HTTP')?err.message:'TMDB request failed');return hit||null;}
 }
 return {lookup,errors,get requests(){return requests;}};
}
