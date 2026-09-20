/* Leaflet + CARTO Voyager, color-preserving dark treatment applied only to tiles.
   The browser tile key is scoped to this map project; without it CARTO
   serves an "API KEY REQUIRED" watermark instead of the map. */
window.MarqueeMap=(()=>{
 /* Base map and place names are fetched as separate layers so each can be
    filtered differently: the base keeps water and parks coloured, while the
    labels are forced to plain greyscale and can never pick up a tint. */
 const KEY='cb1_3m7j_1_17fd37577805412e52f4339d';
 /* Theaters with a photo in assets/theaters. Anything absent just renders the
    popup without one. */
 const SHOTS=new Set(['angelika','afa','bam','cv','ff','ifc','kew','maysles','mg',
                      'nhp','nhw','paris','quad','roxy','spec','synd','udocs']);
 const tileURL='https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key='+KEY;
 const labelURL='https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png?key='+KEY;
 let map,layer,lastSignature='',locations,userMoved=false;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function update({visible,venues,counts,boroughs,cinemas}){
  const section=document.getElementById('theater-map-panel');section.hidden=!visible;
  if(!visible)return;
  const status=document.getElementById('theater-map-status');
  if(!window.L||!window.NYC_THEATER_LOCATIONS){status.hidden=false;status.textContent='Map unavailable. Theater links are still available in the listings below.';return;}
  locations=window.NYC_THEATER_LOCATIONS;
  if(!map){
   map=L.map('theater-map',{scrollWheelZoom:false,zoomSnap:0,zoomDelta:0.5}).setView([40.735,-73.975],13);
   pinchToZoom(map);
   L.tileLayer(tileURL,{className:"marquee-dark-tiles",maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'}).on('tileerror',()=>{status.hidden=false;status.textContent='Some map tiles could not load. Theater pins and links are still available.';}).addTo(map);
   L.tileLayer(labelURL,{className:"marquee-label-tiles",maxZoom:19,zIndex:3}).addTo(map);
   layer=L.layerGroup().addTo(map);
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
    node.innerHTML=`${SHOTS.has(id)?`<img class="popup-shot" data-src="assets/theaters/${id}.jpg" alt="" width="660" height="240">`:''}<strong>${escape(venue.n)}</strong><p>${escape(point.address)}</p><p>${n?n+' matching screening'+(n===1?'':'s'):'No matching screenings in these listings'}</p>`;
    const href=(()=>{try{const u=new URL(venue.url);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}})();
    if(href){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Visit theater →';node.appendChild(a);}
    const marker=L.marker(point.coordinates,{icon:L.divIcon({className:'theater-pin'+(n?'':' muted'),html:'<span></span>',iconSize:[24,24],iconAnchor:[12,12]}),title:venue.n,alt:venue.n,keyboard:true}).bindPopup(node,{autoPan:false,maxWidth:288,minWidth:248}).addTo(layer);
    marker._hasScreenings=n>0;
    hoverPopup(marker);
   }
  }

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
   if(el){const img=el.querySelector('img.popup-shot[data-src]');
    if(img){img.src=img.dataset.src;delete img.dataset.src;}}
   fitPopup(marker);
   if(el&&!el._marqueeHover){el._marqueeHover=true;
    el.addEventListener('mouseenter',()=>clearTimeout(timer));
    el.addEventListener('mouseleave',close);}});
 }

 /* Chromium sends trackpad pinches as ctrl+wheel; Safari uses gesture events.
    Fractional zoom avoids losing small movements to zoom snapping. */
 /* Popups open above the pin, and the photo makes them tall enough that a pin
    near the top of the panel would have its picture cut off. Auto-panning
    would drag the map out from under the cursor and cancel the hover, so the
    popup is flipped below the pin instead when there is no room above. */
 function fitPopup(marker){
  const pop=marker.getPopup(); if(!pop||!pop.getElement||!map.getContainer) return;
  const place=()=>{
   const el=pop.getElement(); if(!el) return;
   const box=el.getBoundingClientRect(), panel=map.getContainer().getBoundingClientRect();
   const below=!!pop.options._marqueeFlipped;
   const wantBelow=below ? box.top-(box.height+34) < panel.top+4   // would it still clip if put back?
                         : box.top < panel.top+4;
   if(wantBelow===below) return;
   pop.options._marqueeFlipped=wantBelow;
   pop.options.offset=wantBelow?L.point(0,box.height+34):L.point(0,7);
   pop.update();
  };
  place();
  const img=pop.getElement()&&pop.getElement().querySelector('img.popup-shot');
  if(img&&!img.complete) img.addEventListener('load',place,{once:true});  // height is only known once it loads
 }

 function pinchToZoom(map){
  const box=map.getContainer&&map.getContainer();
  if(!box||!box.addEventListener)return;
  let gestureActive=false,startZoom=0,anchor;
  const zoom=(value,point)=>{
   userMoved=true;
   const next=Math.min(map.getMaxZoom(),Math.max(map.getMinZoom(),value));
   map.setZoomAround(point,next,{animate:false});
  };
  box.addEventListener('wheel',e=>{
   if(!e.ctrlKey)return;
   e.preventDefault();e.stopPropagation();
   if(gestureActive)return;
   const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?box.clientHeight:1);
   zoom(map.getZoom()-Math.max(-100,Math.min(100,delta))*0.01,map.mouseEventToLatLng(e));
  },{passive:false});
  box.addEventListener('gesturestart',e=>{
   e.preventDefault();e.stopPropagation();
   gestureActive=true;startZoom=map.getZoom();anchor=map.mouseEventToLatLng(e);
   userMoved=true;
  },{passive:false});
  box.addEventListener('gesturechange',e=>{
   if(!gestureActive)return;
   e.preventDefault();e.stopPropagation();
   if(Number.isFinite(e.scale)&&e.scale>0)zoom(startZoom+Math.log2(e.scale),anchor);
  },{passive:false});
  box.addEventListener('gestureend',e=>{
   if(!gestureActive)return;
   e.preventDefault();e.stopPropagation();gestureActive=false;
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
