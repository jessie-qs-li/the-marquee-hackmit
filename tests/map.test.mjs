import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('map respects visibility and venue filters, preserves one map instance, and escapes popup text',()=>{
 const elements={};const element=()=>({hidden:false,textContent:'',innerHTML:'',appendChild(){}});
 const document={getElementById:id=>elements[id]??=element(),createElement:element};
 let created=0,markers=[];const layer={addTo(){return this},clearLayers(){markers=[]},getLayers(){return markers}};
 const map={setView(){return this},invalidateSize(){},fitBounds(){}};
 const L={map(){created++;return map},tileLayer(){return {on(){return this},addTo(){return this}}},layerGroup:()=>layer,divIcon:o=>o,marker:(coords,options)=>({options,bindPopup(node){this.popup=node;return this},addTo(){markers.push(this);return this},getLatLng:()=>coords})};
 const window={L,NYC_THEATER_LOCATIONS:{a:{coordinates:[40.7,-74],address:'A & B'},b:{coordinates:[40.8,-73.9],address:'B'}}};
 const context=vm.createContext({window,L,document,URL,requestAnimationFrame:f=>f()});vm.runInContext(readFileSync(new URL('../assets/theater-map.js',import.meta.url),'utf8'),context);
 const state={visible:true,venues:{a:{n:'<Test>',boro:'Manhattan',url:'https://example.com'},b:{n:'Other',boro:'Brooklyn'}},counts:{a:3},boroughs:new Set(),cinemas:new Set()};
 window.MarqueeMap.update(state);assert.equal(created,1);assert.equal(markers.length,2);assert(markers[0].popup.innerHTML.includes('&lt;Test&gt;'));assert(markers[1].options.icon.className.includes('muted'));
 window.MarqueeMap.update({...state,cinemas:new Set(['a'])});assert.equal(markers.length,1);
 window.MarqueeMap.update({...state,visible:false});assert.equal(elements['theater-map-panel'].hidden,true);
 window.MarqueeMap.update(state);assert.equal(created,1);assert.equal(elements['theater-map-panel'].hidden,false);
 window.MarqueeMap.update({...state,boroughs:new Set(['Bronx'])});assert.equal(markers.length,0);
});
