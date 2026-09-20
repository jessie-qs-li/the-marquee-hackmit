import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTMDBLookup,selectTMDBMatch} from '../scripts/tmdb.mjs';
import {titleKey,cleanTitle,mapGenres} from '../scripts/genres.mjs';
const films=[{id:1,title:'A Movie',release_date:'2024-01-01',genre_ids:[18]},{id:2,title:'A Movie',release_date:'1990-01-01',genre_ids:[27]}];
test('TMDB refuses ambiguous remakes and mismatched years',()=>{
 assert.equal(selectTMDBMatch({title:'A Movie'},films,titleKey),null);
 assert.equal(selectTMDBMatch({title:'A Movie',year:2024},films,titleKey).id,1);
 assert.equal(selectTMDBMatch({title:'A Movie',year:2020},films,titleKey),null);
 assert.equal(selectTMDBMatch({title:'Different'},films,titleKey),null);
});
test('cached matches need no token or repeat network request; negative matches expire',async()=>{
 const root=mkdtempSync(join(tmpdir(),'marquee-tmdb-'));mkdirSync(join(root,'data'));
 try{
  let calls=0;const now=Date.now();const fetcher=async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer test-secret');return {ok:true,json:async()=>String(url).includes('genre/movie')?{genres:[{id:18,name:'Drama'}]}:{results:String(url).includes('Absent')?[]:[films[0]],total_pages:1}};};
  const lookup=createTMDBLookup({root,normalize:titleKey,clean:cleanTitle,token:'test-secret',fetcher,now:()=>now});
  assert.equal((await lookup.lookup({title:'A Movie'})).status,'matched');assert.equal(calls,2);
  await lookup.lookup({title:'A Movie'});assert.equal(calls,2);
  await lookup.lookup({title:'Absent'});assert.equal(calls,3);
  await lookup.lookup({title:'Absent'});assert.equal(calls,3);
  const offline=createTMDBLookup({root,normalize:titleKey,clean:cleanTitle,token:'',fetcher:()=>{throw new Error('Must not fetch');}});
  assert.equal((await offline.lookup({title:'A Movie'})).id,1);
  const later=createTMDBLookup({root,normalize:titleKey,clean:cleanTitle,token:'test-secret',fetcher,now:()=>now+8*86400000});
  await later.lookup({title:'Absent'});assert.equal(calls,4);
  assert(!readFileSync(join(root,'data/tmdb-cache.json'),'utf8').includes('test-secret'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('API authentication errors stop further calls without caching false misses',async()=>{
 const root=mkdtempSync(join(tmpdir(),'marquee-tmdb-'));mkdirSync(join(root,'data'));
 try{let calls=0;const lookup=createTMDBLookup({root,normalize:titleKey,clean:cleanTitle,token:'test',fetcher:async()=>{calls++;return {ok:false,status:401};}});
 assert.equal(await lookup.lookup({title:'A Movie'}),null);assert.equal(await lookup.lookup({title:'Another'}),null);assert.equal(calls,1);assert.deepEqual(lookup.errors,['TMDB HTTP 401']);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('TMDB names map into the ten existing filters',()=>assert.deepEqual(mapGenres(['Science Fiction','Family','History','Music']),['scifi','family','drama','comedy']));
