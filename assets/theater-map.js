/* Leaflet + CARTO Dark Matter, to sit with the rest of the board.
   The browser tile key is scoped to this map project; without it CARTO
   serves an "API KEY REQUIRED" watermark instead of the map. */
window.MarqueeMap=(()=>{
 const tileURL='https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_3m7j_1_17fd37577805412e52f4339d';
 let map,layer,lastSignature='',locations,userMoved=false;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function update({visible,venues,counts,boroughs,cinemas}){
  const section=document.getElementById('theater-map-panel');section.hidden=!visible;
  if(!visible)return;
  const status=document.getElementById('theater-map-status');
  if(!window.L||!window.NYC_THEATER_LOCATIONS){status.textContent='Map unavailable. Theater links are still available in the listings below.';return;}
  locations=window.NYC_THEATER_LOCATIONS;
  if(!map){
   map=L.map('theater-map',{scrollWheelZoom:false,zoomSnap:0.25,zoomDelta:0.5}).setView([40.735,-73.975],13);
   pinchToZoom(map);
   L.tileLayer(tileURL,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'}).on('tileerror',()=>{status.textContent='Some map tiles could not load. Theater pins and links are still available.';}).addTo(map);
   layer=L.layerGroup().addTo(map);
   document.getElementById('map-reset').onclick=()=>{userMoved=false;fit();};
   // once the map has been driven by hand, stop re-framing it underneath them
   if(map.on) map.on('dragstart',()=>{userMoved=true;});
   const box=map.getContainer&&map.getContainer();
   if(box&&box.addEventListener) box.addEventListener('click',e=>{
    if(e.target.closest&&e.target.closest('.leaflet-control-zoom')) userMoved=true;
   },true);
  }
  const ids=Object.keys(locations).filter(id=>venues[id]&&(!boroughs.size||boroughs.has(venues[id].boro))&&(!cinemas.size||cinemas.has(id)));
  const signature=JSON.stringify(ids.map(id=>[id,counts[id]||0]));
  if(signature!==lastSignature){
   layer.clearLayers();lastSignature=signature;
   for(const id of ids){
    const venue=venues[id],n=counts[id]||0,point=locations[id];
    const node=document.createElement('div');
    node.innerHTML=`<strong>${escape(venue.n)}</strong><p>${escape(point.address)}</p><p>${n?n+' matching screening'+(n===1?'':'s'):'No matching screenings in these listings'}</p>`;
    const href=(()=>{try{const u=new URL(venue.url);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}})();
    if(href){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Visit theater →';node.appendChild(a);}
    const marker=L.marker(point.coordinates,{icon:L.divIcon({className:'theater-pin'+(n?'':' muted'),html:'<span></span>',iconSize:[24,24],iconAnchor:[12,12]}),title:venue.n,alt:venue.n,keyboard:true}).bindPopup(node,{autoPan:false}).addTo(layer);
    marker._hasScreenings=n>0;
    hoverPopup(marker);
   }
  }
  status.textContent=`${ids.length} theaters · Red pins have matching screenings`;
  // the panel has just been unhidden, so wait two frames for a real size
  // before framing the pins -- fitting against a stale box lands far too wide
  const frame=()=>{map.invalidateSize();if(ids.length&&!userMoved)fit();};
  requestAnimationFrame(frame);
  if(typeof setTimeout==='function'){setTimeout(frame,150);setTimeout(frame,450);}
 }
 /* Show a theater on hover. The popup carries a link, so closing is deferred
   long enough to move onto it, and cancelled once the pointer is inside. */
 function hoverPopup(marker){
  if(!marker.on||!marker.getPopup)return;
  let timer;
  const open=()=>{clearTimeout(timer);marker.openPopup();
   const el=marker.getPopup().getElement();
   if(el&&!el._marqueeHover){el._marqueeHover=true;
    el.addEventListener('mouseenter',()=>clearTimeout(timer));
    el.addEventListener('mouseleave',close);}};
  const close=()=>{clearTimeout(timer);timer=setTimeout(()=>marker.closePopup(),260);};
  marker.on('mouseover',open).on('mouseout',close);
  marker.on('focus',open).on('blur',close);
  marker.on('popupopen',()=>{const el=marker.getPopup().getElement();
   if(el&&!el._marqueeHover){el._marqueeHover=true;
    el.addEventListener('mouseenter',()=>clearTimeout(timer));
    el.addEventListener('mouseleave',close);}});
 }

 /* A trackpad pinch arrives as ctrl+wheel, which the browser reads as
    page zoom. Over the map, zoom the map instead. A plain two-finger
    scroll is left alone so the page still scrolls normally. */
 function pinchToZoom(map){
  const box=map.getContainer&&map.getContainer();
  if(!box||!box.addEventListener)return;
  box.addEventListener('wheel',e=>{
   if(!e.ctrlKey)return;
   e.preventDefault();
   userMoved=true;
   const step=Math.max(-0.34,Math.min(0.34,-e.deltaY*0.01));
   const next=map.getZoom()+step;
   map.setZoomAround(map.mouseEventToLatLng(e),Math.min(map.getMaxZoom(),Math.max(map.getMinZoom(),next)),{animate:false});
  },{passive:false});
 }

 /* animate:false matters. The panel has only just been unhidden, and an
    animated zoom started in that frame never settles -- the view silently
    stays wherever setView left it. */
 function fit(){
  const all=layer.getLayers();
  // frame the theaters that actually have something on; the dark pins are
  // often outliers (a cinema with nothing listed, or one we cannot scrape)
  // and dragging the bounds out to them pushes the whole city too far away
  const showing=all.filter(m=>m._hasScreenings);
  const points=(showing.length?showing:all).map(m=>m.getLatLng());
  if(points.length) map.fitBounds(L.latLngBounds?L.latLngBounds(points):points,{padding:[22,22],maxZoom:15,animate:false});
 }
 return {update, get map(){return map;}, get layer(){return layer;}};
})();
