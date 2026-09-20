import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,buildIndex,selectMatch,mapGenres,titleKey} from '../scripts/genres.mjs';
test('CSV preserves escaped quotes, commas and pipe genres',()=>{
 const rows=parseCSV('movieId,title,genres\r\n1,"Movie, The (1999)",Drama|Comedy\r\n2,"A ""Quote"" (2000)",Horror');
 assert.equal(rows[0].title,'Movie, The (1999)');assert.equal(rows[1].title,'A "Quote" (2000)');
});
test('matches aliases and suffixes; refuses ambiguous remakes and wrong years',()=>{
 const index=buildIndex([{movieId:'1',title:'Thing, The (1982)',genres:'Horror'},{movieId:'2',title:'Thing, The (2011)',genres:'Horror'},{movieId:'3',title:'Seven (a.k.a. Se7en) (1995)',genres:'Thriller'}]);
 assert.equal(selectMatch({title:'The Thing'},index),null);
 assert.equal(selectMatch({title:'The Thing - 35MM + Q&A',year:1982},index).movieId,'1');
 assert.equal(selectMatch({title:'The Thing',year:1999},index),null);
 assert.equal(selectMatch({title:'Se7en'},index).movieId,'3');
 assert.equal(titleKey('Knife (Open Captioning)'),titleKey('Knife'));
});
test('ten categories preserve multiple genres and do not treat IMAX as genre',()=>{
 assert.deepEqual(mapGenres(['Animation','Children','Comedy','Fantasy','IMAX']),['family','comedy','scifi']);
 assert.deepEqual(mapGenres(['(no genres listed)','IMAX']),[]);
});
