import { LEAFLET_CSS, LEAFLET_JS } from "./leaflet-assets";

export type MapZone = { id: number; name: string; lat: number; lng: number; radius_m: number };
export type MapState = {
  zones: MapZone[];
  me: { lat: number; lng: number; accuracy: number } | null;
  /** Space at the bottom covered by the clock button. */
  padBottom: number;
};

/** Street tiles come from the server (/api/me), so a new map key never needs a new app build. Null = no streets. */
export type MapTiles = { url: string; attribution: string } | null;

/** Optional build-time override, for a server that doesn't send tiles. */
export const BUILT_IN_TILES: MapTiles = process.env.EXPO_PUBLIC_MAP_TILES
  ? {
      url: process.env.EXPO_PUBLIC_MAP_TILES,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }
  : null;

/** JSON for inside a <script> tag: never lets the text close the tag. */
const js = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/**
 * A self-contained Leaflet page shown inside a WebView. The app pushes state in with
 * window.__update(state); the page reports "ready" once loaded. Framing follows the same rules
 * as the admin website: inside the zone, a close view that keeps the zone edge, its label and the
 * person's dot above the clock button; outside it, both the person and the zone in view.
 */
export function buildMapHtml(tiles: MapTiles) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>${LEAFLET_CSS}
html,body,#map{margin:0;padding:0;height:100%;width:100%;}
.leaflet-container{background-color:#eaeff6;background-image:radial-gradient(#cfd9ea 1.2px,transparent 1.2px);background-size:18px 18px;font-family:-apple-system,"Segoe UI",Roboto,sans-serif;}
.leaflet-control-attribution{font-size:9px!important;background:rgba(255,255,255,.78)!important;}
.leaflet-control-zoom{display:none;}
.zl{position:absolute;transform:translate(-50%,calc(-100% - 5px));background:#102a5e;color:#fff;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 6px rgba(6,18,46,.25);}
.me{position:relative;display:block;width:22px;height:22px;}
.me i{position:absolute;inset:3px;border-radius:999px;background:#5d5fe6;}
.me i.p{animation:p 2.4s cubic-bezier(0,0,.2,1) infinite;}
.me i.d{border:3px solid #fff;box-shadow:0 1px 4px rgba(6,18,46,.35);}
@keyframes p{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.4);opacity:0}}
</style></head><body><div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
(function(){
  function post(m){ try{ if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(m);} else if(window.parent){window.parent.postMessage({source:'ma-map',msg:m},'*');} }catch(e){} }
  var map=L.map('map',{zoomControl:false,attributionControl:true,boxZoom:false,keyboard:false});
  map.attributionControl.setPrefix(false); map.attributionControl.setPosition('topleft');
  ${tiles ? `L.tileLayer(${js(tiles.url)},{subdomains:'abcd',maxZoom:20,attribution:${js(tiles.attribution)}}).addTo(map);` : ""}
  map.setView([5.9459,116.0709],16);
  var zonesLayer=L.layerGroup().addTo(map), meLayer=L.layerGroup().addTo(map);
  var state={zones:[],me:null,padBottom:116}, framed='none';
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return '&#'+c.charCodeAt(0)+';';});}
  function dist(a,b,c,d){var R=6371008.8,t=Math.PI/180,x=(c-a)*t,y=(d-b)*t,h=Math.pow(Math.sin(x/2),2)+Math.cos(a*t)*Math.cos(c*t)*Math.pow(Math.sin(y/2),2);return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
  function insideZone(){ if(!state.me) return null; var best=null;
    state.zones.forEach(function(z){var e=dist(state.me.lat,state.me.lng,z.lat,z.lng)-z.radius_m; if(!best||e<best.e) best={z:z,e:e};});
    return best&&best.e<=0?best.z:null; }
  function drawZones(){ zonesLayer.clearLayers();
    state.zones.forEach(function(z){
      L.circle([z.lat,z.lng],{radius:z.radius_m,color:'#0c8e8a',weight:2,dashArray:'6 6',fillColor:'#12a8a2',fillOpacity:.09,interactive:false}).addTo(zonesLayer);
      L.marker([z.lat+z.radius_m/111320,z.lng],{interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[0,0],html:'<span class="zl">'+esc(z.name)+'</span>'})}).addTo(zonesLayer);
    }); }
  function drawMe(){ meLayer.clearLayers(); var m=state.me; if(!m) return;
    L.circle([m.lat,m.lng],{radius:Math.min(m.accuracy,2000),color:'#5d5fe6',weight:1,opacity:.5,fillColor:'#5d5fe6',fillOpacity:.1,interactive:false}).addTo(meLayer);
    L.marker([m.lat,m.lng],{interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],html:'<span class="me"><i class="p"></i><i class="d"></i></span>'})}).addTo(meLayer); }
  function frame(animate){
    var motion=animate?{animate:true}:{reset:true}, pts=[], pad=state.padBottom||24;
    state.zones.forEach(function(z){var b=L.latLng(z.lat,z.lng).toBounds(z.radius_m*2);pts.push(b.getNorthWest(),b.getSouthEast());});
    if(state.me) pts.push(L.latLng(state.me.lat,state.me.lng));
    if(!pts.length) return 'none';
    var z=insideZone();
    if(z&&state.me){
      var size=map.getSize(), bandBottom=size.y-pad+16;
      var centre=function(zm){return map.project([z.lat,z.lng],zm);};
      var radiusPx=function(zm){return centre(zm).y-map.project([z.lat+z.radius_m/111320,z.lng],zm).y;};
      var limits=function(zm){return {low:radiusPx(zm)+46,high:bandBottom-(map.project([state.me.lat,state.me.lng],zm).y-centre(zm).y)};};
      var zoom=16; while(zoom>13&&limits(zoom).low>limits(zoom).high) zoom-=0.5;
      var l=limits(zoom), zoneY=l.low<=l.high?(l.low+l.high)/2:l.high;
      map.setView(map.unproject(centre(zoom).add([0,size.y/2-zoneY]),zoom),zoom,motion);
      return 'full';
    }
    if(pts.length===1) map.setView(pts[0],17,motion);
    else map.fitBounds(L.latLngBounds(pts),Object.assign({paddingTopLeft:[28,44],paddingBottomRight:[28,pad],maxZoom:18},motion));
    return (state.zones.length>0&&!!state.me)?'full':'partial';
  }
  window.__update=function(next){ state=next; drawZones(); drawMe(); if(framed!=='full'){ var r=frame(false); if(r!=='none') framed=r; } };
  window.__recenter=function(){ frame(true); };
  window.addEventListener('resize',function(){ map.invalidateSize(); });
  post('ready'); setTimeout(function(){post('ready');},400); setTimeout(function(){post('ready');},1500);
})();
</script></body></html>`;
}
