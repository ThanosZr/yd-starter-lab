import {PHASES,STARTS,ENDS,fmt,defaultWires,allTerminals,auditBoth,analyzeTopology,replaceWireEndpoint,makeWire,sampleBadWires} from './engine/topology.js';
import QUIZ from './quiz.js';
import {MOTOR_DEFAULTS,motorPoint,ratedLoadTorque,loadTorque,integrateMotor,calculateTrace} from './engine/motor-dynamics.js';
const HAS_QUIZ = false;
const h=React.createElement;
const el=(tag,props,...kids)=>h(tag,props,...kids.flat(Infinity));
const I=(n,props={})=>el('span',{className:'ico',...props},n);
const ICON={wire:'⌁',bolt:'ϟ',settings:'◈',checks:'▣',book:'▤',download:'⇩',power:'⏻',star:'✳',delta:'△',plus:'＋',zoom:'⊕',undo:'↶',layers:'▧',guide:'✧',close:'×',error:'!',play:'▶',pause:'Ⅱ',reset:'↻',link:'◇',save:'⬇'};
const STATUS_LABEL={OFF:'ΑΝΕΝΕΡΓΟ',STAR:'ΑΣΤΕΡΑΣ · Υ',DEAD:'ΝΕΚΡΟΣ ΧΡΟΝΟΣ',DELTA:'ΤΡΙΓΩΝΟ · Δ',TRIP:'ΑΠΟΖΕΥΞΗ'};
const colorPhase=['#ffae69','#60cbe9','#d1a1ff'];
const COLORS={star:'#6fe2cf',delta:'#ffb762',bad:'#ff7285',neutral:'#a6dcfc'};
const MACHINE_COLORS={u:'#ffb978',v:'#58c8ed',w:'#cf9aff',star:'#65e3bc',delta:'#ffcc81',wrong:'#ff6b85'};
const keywire=w=>[w.a,w.b].sort().join('::');
const netKey=g=>g?.members?.slice().sort().join('|')||'';
const idToReadable=t=>t.replace(/^M\./,'').replace(/\./,' · ').replace(/\ba([123])\b/g,'IN $1').replace(/\bb([123])\b/g,'OUT $1');
const defaultLayout={SOURCE:{x:36,y:122},K1M:{x:202,y:122},F3:{x:415,y:122},M:{x:785,y:122},K2M:{x:412,y:452},K3M:{x:780,y:452}};
const boxSpec={SOURCE:{w:108,h:245},K1M:{w:165,h:245},F3:{w:145,h:245},M:{w:207,h:245},K2M:{w:165,h:245},K3M:{w:180,h:245}};
const rows={SOURCE:[68,131,194],K1M:[68,131,194],F3:[68,131,194],M:[68,131,194],K2M:[68,131,194],K3M:[68,131,194]};
function terminalPosition(t,L){
  if(/^L[123]$/.test(t)){const n=Number(t[1])-1,b=L.SOURCE;return {x:b.x+boxSpec.SOURCE.w,y:b.y+rows.SOURCE[n]};}
  const m=t.match(/^([A-Z0-9]+)\.([ab])([123])$/);if(m){const [_,c,side,idx]=m,b=L[c];if(!b)return null;return {x:b.x+(side==='a'?0:boxSpec[c].w),y:b.y+rows[c][Number(idx)-1]};}
  const motor=t.match(/^M\.(U1|V1|W1|U2|V2|W2)$/);if(motor){const start=STARTS.indexOf(motor[1]);const end=ENDS.indexOf(motor[1]);const b=L.M;return {x:b.x+(start>=0?0:boxSpec.M.w),y:b.y+rows.M[start>=0?start:end]};}
  return null;
}
function wirePath(p,q,index=0){const dx=q.x-p.x,dy=q.y-p.y;if(Math.abs(dy)<12)return `M${p.x} ${p.y} L${q.x} ${q.y}`;
  const stagger=((index%5)-2)*9;
  if(Math.abs(dx)<110){const rail=Math.max(28,Math.abs(dx)/2)+stagger;return `M${p.x} ${p.y} H${p.x+rail} V${q.y} H${q.x}`;}
  const x=p.x+dx/2+stagger;return `M${p.x} ${p.y} H${x} V${q.y} H${q.x}`;
}
function ellipsePath(a,b,wiggles=4){const dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy),tx=dx/n,ty=dy/n,nx=-ty,ny=tx;const start=.19,end=.81;
  let result=`M${a.x+dx*.06} ${a.y+dy*.06} L${a.x+dx*start} ${a.y+dy*start}`;
  for(let k=0;k<wiggles*2;k++){const t=start+(k+1)/(wiggles*2+1)*(end-start),off=(k%2===0?11:-11);result+=` L${a.x+dx*t+nx*off} ${a.y+dy*t+ny*off}`;}
  return result+` L${a.x+dx*end} ${a.y+dy*end} L${a.x+dx*.95} ${a.y+dy*.95}`;
}
function downloadText(name,contents,mime='text/plain'){const blob=new Blob([contents],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function svgDownload(name,dom){if(!dom)return;const clone=dom.cloneNode(true);clone.removeAttribute('style');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','1200');clone.setAttribute('height','900');const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent=`text {font-family:Inter,system-ui,Arial,sans-serif;fill:#e6f2ff} .canvas-grid{stroke:#26415b;opacity:.28} .wire{fill:none;stroke:#6d849a;stroke-width:2.7;stroke-linejoin:round;stroke-linecap:round} .terminal{fill:#0b1a2e;stroke:#69c9df;stroke-width:3} .motor-winding{fill:none;stroke:#c8e3fa;stroke-width:3.3;stroke-linejoin:round;stroke-linecap:round} .netlink{fill:none;stroke-width:4;stroke-linecap:round} .tiny{font-size:13px;fill:#aac2d5} .boxtext{font-weight:700;font-size:18px} .pinlabel{font-size:12px;fill:#e3f1f9} .bodytext{font-size:15px;fill:#bbcede}`;clone.insertBefore(style,clone.firstChild);downloadText(name,`<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`,'image/svg+xml');}
function starLeadWires(wires){return wires.filter(w=>/^K3M\.a[123]$/.test(w.a)||/^K3M\.a[123]$/.test(w.b));}
function starIsDisconnected(wires,thermal){
  const reference=defaultWires(thermal).filter(w=>!starLeadWires([w]).length);
  const expected=new Set(reference.map(keywire)),actual=new Set(wires.map(keywire));
  return starLeadWires(wires).length===0&&reference.every(w=>actual.has(keywire(w)))&&wires.every(w=>expected.has(keywire(w)));
}
function chartSvg(series,options={}){
 const width=820,height=280,pad={l:58,r:20,t:18,b:38};
 const x0=pad.l,x1=width-pad.r,y0=pad.t,y1=height-pad.b;
 const data=series.flatMap(l=>l.points.map(p=>p[1])).filter(Number.isFinite);
 const minY=options.minY!==undefined?options.minY:Math.min(0,...data),maxY=options.maxY!==undefined?options.maxY:Math.max(1,...data);
 const ymin=minY===maxY?minY-1:minY,ymax=minY===maxY?maxY+1:maxY;
 const X=x=>x0+(x-options.xMin)/(options.xMax-options.xMin||1)*(x1-x0);
 const Y=y=>y1-(y-ymin)/(ymax-ymin)*(y1-y0);
 const tickStyle={fontSize:11,fill:'#a9becf'};
 return el('svg',{className:'trend-svg',viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':options.title||'Γράφημα'},
  el('rect',{x:0,y:0,width,height,rx:11,fill:'#0c1a2b'}),
  ...Array.from({length:5},(_,i)=>{const y=ymin+i*(ymax-ymin)/4;return el('g',{key:'g'+i},el('line',{x1:x0,x2:x1,y1:Y(y),y2:Y(y),stroke:'#2c4a60',strokeDasharray:'3 6'}),el('text',{x:49,y:Y(y)+4,textAnchor:'end',style:tickStyle},Number(y).toFixed(options.digits===0?0:1)));}),
  ...Array.from({length:5},(_,i)=>{const x=options.xMin+i*(options.xMax-options.xMin)/4;return el('text',{key:'t'+i,x:X(x),y:height-15,textAnchor:'middle',style:tickStyle},Number(x).toFixed(1));}),
  ...series.map((l,i)=>el('path',{key:l.name||i,d:l.points.filter(p=>Number.isFinite(p[1])).map((p,j)=>`${j?'L':'M'}${X(p[0]).toFixed(2)} ${Y(p[1]).toFixed(2)}`).join(' '),stroke:l.color,fill:'none',strokeWidth:l.width||2.7,strokeLinejoin:'round',strokeLinecap:'round',opacity:l.opacity||1})),
  el('text',{x:64,y:14,style:tickStyle},options.title||''),el('text',{x:width-24,y:height-15,style:tickStyle,textAnchor:'end'},options.xLabel||'s'));
}
function appState(){let loaded={};try{loaded=JSON.parse(localStorage.getItem('ydlab-v2')||'{}')}catch{}
 return {tab:'workspace',wires:Array.isArray(loaded.wires)?loaded.wires:defaultWires(),thermal:loaded.thermal||'line',strategy:loaded.strategy||'mounted',loadPct:10,loadShape:'constant',params:{...MOTOR_DEFAULTS},history:[],bypassStar:false,live:{torque:0,load:0,current:0,slip:1,rpm:0},preview:'star',run:'OFF',time:0,speed:0,switchAt:0,plate:'400/690',vl:400,z:20,inum:20,delay:4,deadTime:.32,threshold:85,mode:'edit',showTip:true,labels:loaded.labels||{},netLabels:loaded.netLabels||{},layout:loaded.layout||structuredClone(defaultLayout),selectedWire:null,selectedPin:null,pending:null,zoom:{power:1,diagram:1},pan:{power:{x:0,y:0},diagram:{x:0,y:0}},dragPreview:null,alert:'Έτοιμο. Σύρε καλώδιο από έναν ακροδέκτη σε άλλον ή χρησιμοποίησε την καθοδηγούμενη κατασκευή.',quizIndex:0,answers:{},reveal:true,filter:'όλα',guide:0,showNets:true};}
class App extends React.Component {
 constructor(p){super(p);this.state=appState();this.pointer=null;this.lastTick=performance.now();this.svgRefs={};this.frameRef=null;}
 componentDidMount(){this.timer=setInterval(()=>this.tick(),95);window.addEventListener('keydown',this.onGlobalKey);}
 componentWillUnmount(){clearInterval(this.timer);window.removeEventListener('keydown',this.onGlobalKey)}
 onGlobalKey=(e)=>{if(e.key==='Escape')this.setState({pending:null,selectedWire:null,selectedPin:null,dragPreview:null});if((e.key==='Delete'||e.key==='Backspace')&&document.activeElement?.tagName!=='INPUT'&&document.activeElement?.tagName!=='TEXTAREA'&&document.activeElement?.tagName!=='SELECT'){this.removeSelected();}}
 patch=(p,save=false)=>this.setState(p,()=>{if(save)this.persist();});
 persist=()=>{const s=this.state;try{localStorage.setItem('ydlab-v2',JSON.stringify({wires:s.wires,labels:s.labels,netLabels:s.netLabels,layout:s.layout,thermal:s.thermal,strategy:s.strategy}))}catch{}}
 changeWires=(w,notice)=>this.setState({wires:w,run:'OFF',time:0,speed:0,history:[],live:{torque:0,load:0,current:0,slip:1,rpm:0},bypassStar:false,alert:notice||'Το κύκλωμα επανυπολογίστηκε από την πραγματική συνδεσιμότητα.'},this.persist);
 autoBuild=(type='standard')=>{
   const w=defaultWires(this.state.thermal);
   this.changeWires(type==='without-star'?w.filter(x=>!starLeadWires([x]).length):w,
     type==='without-star'?'Αφαιρέθηκαν οι 3 συνδέσεις U2/V2/W2 προς K3M. Ο K3M οπλίζει χωρίς να σχηματίζει Υ· μετά τον χρόνο εφαρμόζεται Δ (DOL εκκίνηση με καθυστέρηση).':'Αυτόματη δημιουργία 18 αγωγών Υ/Δ. Έλεγξε την προεπισκόπηση και τη θέση F3.');
 };
 refreshLayout=()=>this.patch({layout:structuredClone(defaultLayout)},true);
 audit=()=>auditBoth(this.state.wires,{vl:this.state.vl,z:this.state.z,thermal:this.state.thermal});
 activePreview=()=>this.state.run==='STAR'?'star':this.state.run==='DELTA'?'delta':this.state.preview;
 changeF3=(thermal)=>{this.patch({thermal,layout:{...this.state.layout,F3:thermal==='winding'?{x:610,y:122}:{x:415,y:122}},run:'OFF',time:0,speed:0,bypassStar:false,history:[],wires:defaultWires(thermal),selectedWire:null,alert:'Το F3 μετακινήθηκε στην πρότυπη τοπολογία. Επαναφέρθηκαν τα καλώδια ώστε η νέα θέση να είναι ηλεκτρικά σωστή.'},true)};
 start=()=>{
   const a=this.audit(),removed=starIsDisconnected(this.state.wires,this.state.thermal);
   if(!(a.ready || (removed&&a.delta.healthy))){this.patch({alert:'⛔ START αποκλείστηκε: λανθασμένη/ελλιπής συνδεσμολογία. Η ειδική δοκιμή επιτρέπει μόνο αφαίρεση ΚΑΙ των τριών γραμμών προς K3M με το υπόλοιπο Δ σωστό.'});return;}
   if(removed&&this.state.strategy==='speed'){this.patch({alert:'⛔ Χωρίς αστέρα και χωρίς κίνηση δεν επιτυγχάνεται το όριο ταχύτητας. Χρησιμοποίησε μηχανικό ή ανεξάρτητο χρονικό.'});return;}
   if(this.state.plate==='230/400'&&this.state.vl>260){this.patch({alert:'⛔ Κινητήρας 230/400 V (Δ/Υ) δεν επιτρέπεται να λειτουργήσει σε Δ με τάση γραμμής 400 V.'});return;}
   this.lastTick=performance.now();this.patch({run:'STAR',bypassStar:removed,preview:'star',time:0,switchAt:0,speed:0,history:[],live:{torque:0,load:0,current:0,slip:1,rpm:0},alert:removed?'K1M+K3M οπλίζουν, αλλά λείπουν ΚΑΙ οι 3 γέφυρες του Υ: ο κινητήρας μένει ακίνητος. Μόνο μετά τη χρονική μεταγωγή σε Δ εμφανίζεται ρεύμα εκκίνησης.':'K1M+K3M ενεργοποιούνται. Ο κινητήρας επιταχύνει σε Υ, το πρόσθετο χρονικό μετρά όταν οπλίσει ο K3M.'});
 };
 stop=()=>this.patch({run:'OFF',bypassStar:false,alert:'STOP: το κύκλωμα ισχύος ανοίγει. Διατηρείται το ιστορικό κυματομορφών.'});
 trip=()=>this.patch({run:'TRIP',bypassStar:false,alert:'F3: θερμική απόζευξη (χειροκίνητη δοκιμή· δεν υλοποιείται καμπύλη θερμικής προστασίας).'});
 tick=()=>{
   const t=performance.now(),dt=Math.min((t-this.lastTick)/1000,.2);this.lastTick=t;const s=this.state;
   if(!['STAR','DEAD','DELTA'].includes(s.run))return;
   const runForMotor=s.bypassStar&&s.run==='STAR'?'DEAD':s.run;
   const m=integrateMotor(s.speed,dt,runForMotor,s.loadPct,s.vl,s.params,s.loadShape);
   const speed=m.speed,time=s.time+dt;
   let run=s.run,preview=s.preview,switchAt=s.switchAt,alert=s.alert;
   if(run==='STAR'&&(s.strategy==='speed'?speed*100>=s.threshold:time>=s.delay)){
     run='DEAD';switchAt=time;alert='K3M ανοίγει, νεκρός χρόνος, έπειτα επιτρέπεται η ενεργοποίηση του K2M.';
   }else if(run==='DEAD'&&time-s.switchAt>=s.deadTime){
     run='DELTA';preview='delta';alert=s.bypassStar?'K2M κλείνει: πρώτη εφαρμογή τάσης στον κινητήρα ως Δ, υψηλό ρεύμα εκκίνησης (DOL με χρονική καθυστέρηση).':'K2M κλείνει: λειτουργία σε Δ.';
   }
   const point={time,run:s.run,speed,slip:m.slip,torque:m.torque,load:m.load,current:m.current};
   const history=[...s.history,point].filter((_,i,a)=>i%1===0).slice(-420);
   this.patch({time,speed,run,preview,switchAt,live:m,history,alert});
 };
 // Shared canvas interaction engine. All edits are performed against the same wire graph.
 coords=(scope,e)=>{const svg=this.svgRefs[scope];if(!svg)return{x:0,y:0};
   const ctm=svg.getScreenCTM();if(ctm){const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const local=pt.matrixTransform(ctm.inverse());return{x:local.x,y:local.y};}
   const r=svg.getBoundingClientRect(),base=scope==='power'?{w:1030,h:790}:{w:900,h:790},z=this.state.zoom[scope],v=this.state.pan[scope];
   return{x:(e.clientX-r.left)/r.width*base.w/z+v.x,y:(e.clientY-r.top)/r.height*base.h/z+v.y};};
 setZoom=(scope,v)=>{const zoom={...this.state.zoom,[scope]:Math.max(.52,Math.min(2.6,v))};this.patch({zoom});};
 canvasWheel=(scope,e)=>{e.preventDefault();this.setZoom(scope,this.state.zoom[scope]*(e.deltaY<0?1.13:.885));};
 touchCanvasStart=(scope,e)=>{if(e.target?.closest?.('[data-pin]'))return;
   const first=e.touches[0],second=e.touches[1];this.touchGesture={scope,basePan:{...this.state.pan[scope]},x:first.clientX,y:first.clientY,z:this.state.zoom[scope],dist:second?Math.hypot(first.clientX-second.clientX,first.clientY-second.clientY):0};};
 touchCanvasMove=(scope,e)=>{const t=this.touchGesture;if(!t||t.scope!==scope)return;e.preventDefault();
   if(e.touches.length>1&&t.dist){const a=e.touches[0],b=e.touches[1];this.setZoom(scope,t.z*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/t.dist);return;}
   const first=e.touches[0],svg=this.svgRefs[scope],r=svg?.getBoundingClientRect();if(!first||!r)return;
   const width=scope==='power'?1030:900,height=790;
   this.patch({pan:{...this.state.pan,[scope]:{x:t.basePan.x-(first.clientX-t.x)/r.width*width/this.state.zoom[scope],y:t.basePan.y-(first.clientY-t.y)/r.height*height/this.state.zoom[scope]}}});};

 touchPin=(e,t,scope)=>{e.stopPropagation();e.preventDefault();if(this.state.pending&&this.state.pending!==t){this.connectPair(this.state.pending,t,scope);this.patch({pending:null,selectedPin:t});}else this.patch({pending:t,selectedPin:t});};
 beginPin=(e,t,scope)=>{e.stopPropagation();e.preventDefault();if(this.state.pending&&this.state.pending!==t){this.connectPair(this.state.pending,t,scope);this.patch({pending:null,dragPreview:null});return;}
  this.pointer={type:'wire',source:t,scope,moved:false,start:e.clientX,sy:e.clientY};this.patch({pending:t,selectedPin:t,selectedWire:null});};
 connectPair=(from,to,scope)=>{let wires=this.state.wires;
   // Diagram pads for protected line outputs are real F3.b* terminals.
   // Reconnecting a visible lead moves the physical copper wire on the power canvas.
   const isOutput=x=>/^(F3\.b[123]|K2M\.b[123]|K3M\.a[123])$/.test(x);
   const isMotor=x=>/^M\.(U[12]|V[12]|W[12])$/.test(x);
   if(scope==='diagram'&&(isOutput(from)||isOutput(to))&&(isMotor(from)||isMotor(to))){
     const contact=isOutput(from)?from:to,other=isMotor(from)?from:to;
     const edge=wires.find(w=>(w.a===contact&&isMotor(w.b))||(w.b===contact&&isMotor(w.a)));
     if(edge){wires=replaceWireEndpoint(wires,edge.id,edge.a===contact?'b':'a',other);
       this.changeWires(wires,`${contact.replace('F3.b','L · F3.out')} → ${other.replace('M.','')}: μετακινήθηκε πραγματικός αγωγός.`);this.patch({selectedWire:edge.id});return;}
   }
   const changed=makeWire(wires,from,to);
   if(changed===wires){this.patch({alert:'Δεν προστέθηκε αγωγός: ίδια άκρα ή σύνδεση που υπάρχει ήδη.'});return;}
   this.changeWires(changed,`Νέα ηλεκτρική σύνδεση ${idToReadable(from)} ↔ ${idToReadable(to)}.`);
   this.patch({selectedWire:changed[changed.length-1].id});
 };
 beginWireEndpoint=(e,id,end,scope)=>{e.stopPropagation();e.preventDefault();this.pointer={type:'reroute',id,end,scope,moved:false,start:e.clientX,sy:e.clientY};this.patch({selectedWire:id,pending:null});};
 beginComponent=(e,name,scope)=>{if(scope!=='power')return;e.stopPropagation();const pos=this.coords(scope,e);this.pointer={type:'component',name,scope,offset:{x:pos.x-this.state.layout[name].x,y:pos.y-this.state.layout[name].y}};};
 canvasDown=(scope,e)=>{if(e.button!==0)return;const xy=this.coords(scope,e);this.pointer={type:'pan',scope,xy,old:{...this.state.pan[scope]}};};
 canvasMove=(scope,e)=>{if(!this.pointer||this.pointer.scope!==scope)return;const p=this.pointer;
  if(p.type==='pan'){const pt=this.coords(scope,e),pan={...this.state.pan,[scope]:{x:p.old.x-(pt.x-p.xy.x),y:p.old.y-(pt.y-p.xy.y)}};this.patch({pan});}
  else if(p.type==='component'){const pt=this.coords(scope,e),layout={...this.state.layout,[p.name]:{x:Math.max(10,Math.min(980,pt.x-p.offset.x)),y:Math.max(40,Math.min(660,pt.y-p.offset.y))}};this.patch({layout});}
  else if(p.type==='wire'||p.type==='reroute'){if(Math.hypot(e.clientX-p.start,e.clientY-p.sy)>3)p.moved=true;this.patch({dragPreview:{scope,from:p.source||null,xy:this.coords(scope,e),id:p.id,end:p.end}});}
 };
 canvasUp=(scope,e)=>{const p=this.pointer;if(!p||p.scope!==scope)return;this.pointer=null;
  if(p.type==='wire'||p.type==='reroute'){const at=document.elementFromPoint(e.clientX,e.clientY);const target=at?.closest?.('[data-pin]')?.getAttribute('data-pin');
   if(target){if(p.type==='reroute'){const wires=replaceWireEndpoint(this.state.wires,p.id,p.end,target);this.changeWires(wires,`Το άκρο του αγωγού μετακινήθηκε στον ακροδέκτη ${target}.`);}
     else if(target!==p.source){this.connectPair(p.source,target,scope);this.patch({pending:null});}}
   this.patch({dragPreview:null});
  }else if(p.type==='component'){this.persist();}
 };
 deleteWire=id=>this.changeWires(this.state.wires.filter(w=>w.id!==id),'Ο αγωγός αφαιρέθηκε. Η τοπολογία υπολογίστηκε ξανά.');
 removeSelected=()=>{if(this.state.selectedWire){this.deleteWire(this.state.selectedWire);this.patch({selectedWire:null});}};
 suggested=()=>defaultWires(this.state.thermal).find(w=>!this.state.wires.some(x=>keywire(x)===keywire(w)));
 suggestAdd=()=>{const next=this.suggested();if(!next){this.patch({alert:'Όλοι οι 18 αγωγοί του προτύπου υπάρχουν.'});return;}
  this.changeWires([...this.state.wires,{...next}],`Πρόταση συνδεσμολογίας: ${idToReadable(next.a)} → ${idToReadable(next.b)}.`);};
 generateReport=()=>{const a=this.audit();downloadText('yd-lab-workspace.json',JSON.stringify({name:'YD LAB v2',saved:new Date().toISOString(),wires:this.state.wires,thermal:this.state.thermal,labels:this.state.labels,layout:this.state.layout,star:{faults:a.star.faults,warnings:a.star.warnings},delta:{faults:a.delta.faults,warnings:a.delta.warnings}},null,2),'application/json')};
 loadReport=e=>{const file=e.target.files?.[0];if(!file)return;const fr=new FileReader();fr.onload=()=>{try{const a=JSON.parse(fr.result);if(!Array.isArray(a.wires))throw Error('Άκυρο αρχείο');this.patch({wires:a.wires,thermal:a.thermal||'line',labels:a.labels||{},layout:a.layout||structuredClone(defaultLayout),run:'OFF',alert:'Το αποθηκευμένο κύκλωμα εισήχθη.'},true);}catch(err){this.patch({alert:'Σφάλμα εισαγωγής: '+err.message});}};fr.readAsText(file);};
 navTab=(id,icon,label)=>el('button',{key:id,className:'nav-item '+(this.state.tab===id?'active':''),onClick:()=>this.patch({tab:id})},el('span',{className:'nav-icon'},icon),el('span',null,label));
 badge=(text,variant='')=>el('span',{className:'badge '+variant},text);
 button=(text,fn,extra='',disabled=false)=>el('button',{type:'button',className:'btn '+extra,onClick:fn,disabled},text);
 render(){const s=this.state;const both=this.audit(),active=this.activePreview(),mode=s.run==='DEAD'?'dead':s.run==='OFF'||s.run==='TRIP'?'preview':active;
  const current=active==='star'?both.star:both.delta;
  return el('div',{className:'app'},
    el('header',{className:'topbar'},
      el('div',{className:'brand'},el('div',{className:'brand-mark'},'Y','/', 'Δ'),el('div',null,el('div',{className:'brand-title'},'YD LAB',el('span',null,' / CIRCUIT STUDIO')),el('div',{className:'brand-sub'},'ΔΙΑΔΡΑΣΤΙΚΟ ΕΡΓΑΣΤΗΡΙΟ ΑΣΤΕΡΑ – ΤΡΙΓΩΝΟΥ'))),
      el('div',{className:'top-status'},el('span',{className:'status-dot '+(both.ready?'good':'bad')}),both.ready?'ΤΟΠΟΛΟΓΙΑ ΕΓΚΥΡΗ':'ΑΠΑΙΤΕΙΤΑΙ ΕΛΕΓΧΟΣ',el('span',{className:'top-divider'}),`18 πρότυποι αγωγοί · ${s.wires.length} στο σχέδιο`),
      el('div',{className:'top-actions'},this.button('↶ Επαναφορά',()=>{if(confirm('Επαναφορά πρότυπου κυκλώματος;'))this.changeWires(defaultWires(s.thermal),'Επανήλθε η έγκυρη πρότυπη συνδεσμολογία.')},'quiet'),this.button('↓ PROJECT',this.generateReport,'action'))),
    el('div',{className:'body-grid'},
      el('aside',{className:'sidebar'},
       el('div',{className:'navgroup'},el('div',{className:'side-heading'},'WORKSPACE'),this.navTab('workspace','◈','Schematic editor'),this.navTab('control','⟟','Ρελέ & αυτοματισμός'),this.navTab('dynamics','∿','Κυματομορφές & ροπή'),HAS_QUIZ?this.navTab('quiz','▤','Εξάσκηση · 36'):null,this.navTab('help','ⓘ','Οδηγός')),
       el('div',{className:'sidebar-bottom'},el('div',{className:'help-info'},'ΜΕΛΕΤΗ ΧΩΡΙΣ ΤΑΣΗ',el('p',null,'Οι ηλεκτρικές συνδέσεις προσομοιώνονται. Δεν εκτελείται χειρισμός πραγματικού εξοπλισμού.')),el('div',{className:'build-stamp'},'REACT / SVG ENGINE',el('span',null,'v3.0')))),
      el('main',{className:'main'},
       s.tab==='workspace'?this.renderWorkspace(both,current,mode):s.tab==='control'?this.renderControl():s.tab==='dynamics'?this.renderDynamics():s.tab==='quiz'&&HAS_QUIZ?this.renderQuiz():this.renderHelp(),
       el('footer',{className:'footer'},'YD LAB · Η τοπολογία ελέγχεται από γράφο. Η δυναμική κινητήρα χρησιμοποιεί εκπαιδευτικό ισοδύναμο μόνιμης κατάστασης και προσεγγιστική ολοκλήρωση κίνησης.',el('span',null,'offline · GitHub Pages ready')))
    ));}
 renderWorkspace(both,current,mode){const s=this.state;const next=this.suggested();const netRows=current.groups.filter(g=>g.members.some(t=>t.startsWith('M.')||PHASES.includes(t))).slice(0,12).map(g=>el('div',{key:g.id,className:'net-row'},el('span',{className:'net-indicator',style:{background:g.phases[0]?colorPhase[PHASES.indexOf(g.phases[0])]:'#8da6bd'}}),el('strong',null,s.netLabels[netKey(g)]||g.phases.join('/')||g.id),el('span',null,g.members.filter(t=>t.startsWith('M.')||PHASES.includes(t)).map(t=>s.labels[t]||t).join(' · '))));
   return el('div',{className:'workspace'},
     el('div',{className:'page-head'},el('div',null,el('div',{className:'eyebrow'},'ENGINEERING WORKSPACE  /  01'),el('h1',null,'Δημιούργησε τη συνδεσμολογία σου'),el('p',null,'Καλωδίωσε τις L1/L2/L3, τον στάτη και τους επαφείς. Σύρε ένα καλώδιο και δες το αποτέλεσμα και στα δύο σχέδια.')),
       el('div',{className:'head-pills'},this.badge('LIVE TOPOLOGY','teal'),this.badge('2-WAY EDITOR','blue'))),
     el('div',{className:'toolbar'},
       el('div',{className:'toolbar-left'},this.button('✳ AUTO: έτοιμο Υ/Δ',()=>this.autoBuild(),'soft'),this.button('✂ AUTO: χωρίς κλάδο Υ',()=>this.autoBuild('without-star'),'outline'),this.button('＋ Κενό κύκλωμα',()=>this.changeWires([],'Κενό κύκλωμα. Πρόσθεσε αγωγούς με σύρσιμο.'),'quiet'),this.button('⚠ Δοκιμή λάθους',()=>this.changeWires(sampleBadWires(),'Φορτώθηκε σκόπιμα λάθος συνδεσμολογία για διάγνωση.'),'quiet')),
       el('div',{className:'toolbar-right'},this.button('↺ Διάταξη',this.refreshLayout,'quiet'),this.button('⇧ Εισαγωγή',()=>this.importInput?.click(),'outline'),el('input',{type:'file',accept:'.json,application/json',ref:n=>this.importInput=n,style:{display:'none'},onChange:this.loadReport}),this.button('⇩ SVG ΙΣΧΥΟΣ',()=>svgDownload('yd-lab-power.svg',this.svgRefs.power),'outline'),this.button('⇩ SVG ΥΔ',()=>svgDownload('yd-lab-equivalent.svg',this.svgRefs.diagram),'outline'))),
     el('div',{className:'two-views'},
       el('section',{className:'canvas-panel power-pane'},
         this.canvasHeader('01 / CIRCUIT', 'Κύκλωμα ισχύος','Σύρε τα άκρα των αγωγών ή τα εξαρτήματα','power'),
         this.powerSvg(current,mode),
         el('div',{className:'canvas-bottom'},el('span',null,'● Πάτησε έναν ακροδέκτη και μετά έναν δεύτερο ή σύρε μεταξύ τους'),el('span',{className:'shortcut'},'WHEEL  ZOOM · DRAG  PAN'))),
       el('section',{className:'canvas-panel diagram-pane'},
         this.canvasHeader('02 / EQUIVALENT', 'Συνδέσεις τυλιγμάτων','Καλωδίωσε τις φάσεις, τα τυλίγματα και τους επαφείς','diagram'),
         this.diagramSvg(current),
         el('div',{className:'machine-action-bar'},el('span',null,'● Σύνδεσε δύο κυκλικούς ακροδέκτες με drag ή taps. Πάτησε αγωγό για αλλαγή/διαγραφή. Διασταύρωση χωρίς κοινό κυκλικό port ΔΕΝ αποτελεί ηλεκτρική ένωση.'),this.button('✕ Σβήσε επιλεγμένο καλώδιο',()=>this.removeSelected(),'danger-outline',!s.selectedWire)),
         this.topologyPreview(current),
         el('div',{className:'canvas-bottom'},el('span',null,'Κάθε αλλαγή αποτυπώνεται και στο κύκλωμα ισχύος'),el('span',{className:'shortcut'},'LIVE ENGINE · TWO-WAY')))),
     el('div',{className:'workspace-lower'},
       el('section',{className:'panel editor-controls'},
         el('div',{className:'subhead'},'ΚΑΘΟΔΗΓΟΥΜΕΝΗ ΚΑΤΑΣΚΕΥΗ',this.badge(`${s.wires.length}/18`,'blue')),
         el('div',{className:'guide-message'},next?[el('strong',{key:'h'},'Επόμενο προτεινόμενο καλώδιο'),el('div',{key:'w'},`${idToReadable(next.a)}  →  ${idToReadable(next.b)}`)]:el('strong',null,'Το πρότυπο κύκλωμα έχει ολοκληρωθεί.')),
         el('div',{className:'guide-actions'},this.button('＋ Πρόσθεσέ το',this.suggestAdd,'primary',!next),this.button('⚙ Αυτόματη κατασκευή',()=>this.autoBuild(),'soft'),this.button('📋 Εξαγωγή JSON',this.generateReport,'quiet')),
         el('div',{className:'divider'}),el('div',{className:'subhead'},'ΕΠΙΛΕΓΜΕΝΟ ΣΤΟΙΧΕΙΟ'),this.renderInspector()),
       el('section',{className:'panel status-controls'},
         el('div',{className:'subhead'},'ΠΡΟΣΟΜΟΙΩΣΗ / ΕΛΕΓΧΟΣ',this.badge(STATUS_LABEL[s.run],s.run==='DELTA'?'amber':s.run==='STAR'?'teal':'')),
         el('div',{className:'field-grid'},el('label',null,'Προβολή επαφών',el('div',{className:'segmented'},this.button('Υ',()=>this.patch({preview:'star',run:'OFF'}),s.preview==='star'?'selected':''),this.button('Δ',()=>this.patch({preview:'delta',run:'OFF'}),s.preview==='delta'?'selected':''))),
           el('label',null,'Θέση θερμικού F3',el('select',{value:s.thermal,onChange:e=>this.changeF3(e.target.value)},el('option',{value:'line'},'Εντός γραμμής'),el('option',{value:'winding'},'Εντός τυλιγμάτων Δ'))),
           el('label',null,'Τάση γραμμής (V)',el('input',{type:'number',min:100,max:1000,value:s.vl,onChange:e=>this.patch({vl:Math.max(1,Number(e.target.value))})})),
           el('label',null,'|Ζ| / τύλιγμα (Ω)',el('input',{type:'number',min:1,step:1,value:s.z,onChange:e=>this.patch({z:Math.max(1,Number(e.target.value))})})),
           el('label',null,'Πινακίδα Δ/Υ',el('select',{value:s.plate,onChange:e=>this.patch({plate:e.target.value})},el('option',{value:'400/690'},'400/690 V'),el('option',{value:'230/400'},'230/400 V'))),
           el('label',null,'Ονομαστικό Iₙ (A)',el('input',{type:'number',min:1,value:s.inum,onChange:e=>this.patch({inum:Math.max(1,Number(e.target.value))})}))),
         el('div',{className:'f3-recommend'},el('div',null,el('strong',null,'ΠΡΟΤΑΣΗ ΕΝΑΛΛΑΚΤΙΚΗΣ ΘΕΣΗΣ F3'),el('p',null,s.thermal==='line'?`Τώρα F3 στη γραμμή: ρύθμιση ${fmt(s.inum)} A (Iₙ). Δοκίμασε εντός βρόχου Δ: ρύθμιση ${fmt(s.inum/Math.sqrt(3))} A.`:`Τώρα F3 στον βρόχο Δ: ρύθμιση ${fmt(s.inum/Math.sqrt(3))} A. Δοκίμασε τη θέση στη γραμμή: ${fmt(s.inum)} A.`)),this.button(s.thermal==='line'?'⇄ Μετέφερε F3 στο Δ':'⇄ Μετέφερε F3 στη γραμμή',()=>this.changeF3(s.thermal==='line'?'winding':'line'),'soft')),
         el('div',{className:'runbar'},this.button('▶ START',this.start,'start',s.run==='STAR'||s.run==='DEAD'||s.run==='DELTA'),this.button('■ STOP',this.stop,'stop'),this.button('ϟ TRIP',this.trip,'outline')),
         el('div',{className:'metric-row'},this.metric('V ανά τύλιγμα',`${fmt(current.windingVoltage)} V`),this.metric('I γραμμής',`${fmt(current.lineCurrent)} A`),this.metric('I τυλίγματος',`${fmt(current.windingCurrent)} A`),this.metric('F3 ρύθμιση',`${fmt(s.thermal==='line'?s.inum:s.inum/Math.sqrt(3))} A`)),
         el('div',{className:'footnote'},'Εναλλακτική θέση F3: στη γραμμή (100% Iₙ), ή μέσα στον βρόχο Δ (~Iₙ/√3 = 0,58 Iₙ). Η αλλαγή επαναφέρει το πρότυπο καλωδίωσης για τη νέα θέση. Οι στατικοί υπολογισμοί του editor χρησιμοποιούν |Z|, οι δυναμικές καμπύλες χρησιμοποιούν χωριστό ισοδύναμο κινητήρα.'),this.button('∿ Προβολή κυματομορφών και ροπής',()=>this.patch({tab:'dynamics'}),'primary'))),
       el('section',{className:'panel diagnostics'},el('div',{className:'subhead'},'DIAGNOSTIC ENGINE',this.badge(both.ready?'PASS':starIsDisconnected(s.wires,s.thermal)&&both.delta.healthy?'Δ ΜΟΝΟ':'FAULT',both.ready?'teal':starIsDisconnected(s.wires,s.thermal)&&both.delta.healthy?'amber':'red')),
         el('div',{className:'diagnostics-grid'},this.diagnosticItem('ΑΣΤΕΡΑΣ',both.star),this.diagnosticItem('ΤΡΙΓΩΝΟ',both.delta)),
         el('div',{className:'diag-message '+(both.ready?'success':'warning')},s.alert),
         el('div',{className:'net-summary'},el('div',{className:'subhead'},'ΚΟΙΝΟΙ ΚΟΜΒΟΙ / ΚΑΛΩΔΙΑ'),...netRows))
     );
 }
 diagnosticItem=(label,result)=>el('div',{className:'diag-card '+(result.healthy?'pass':'fail')},el('span',null,label),el('strong',null,result.healthy?'✓ ΕΓΚΥΡΟ':'✕ ΣΦΑΛΜΑ'),!result.healthy?el('small',null,[...result.faults,...result.warnings][0]):el('small',null,'Ηλεκτρικοί κόμβοι συνεπείς'));
 metric=(name,value)=>el('div',{className:'metric'},el('span',null,name),el('strong',null,value));
 canvasHeader=(serial,title,subtitle,scope)=>el('div',{className:'canvas-head'},el('div',null,el('span',{className:'serial'},serial),el('strong',null,title),el('small',null,subtitle)),el('div',{className:'canvas-tools'},this.button('−',()=>this.setZoom(scope,this.state.zoom[scope]/1.23),'mini'),el('span',{className:'zoom-label'},`${Math.round(this.state.zoom[scope]*100)}%`),this.button('+',()=>this.setZoom(scope,this.state.zoom[scope]*1.23),'mini'),this.button('⌖',()=>this.patch({zoom:{...this.state.zoom,[scope]:1},pan:{...this.state.pan,[scope]:{x:0,y:0}}}),'mini')));
 renderInspector(){const s=this.state;
  if(s.selectedWire){const w=s.wires.find(w=>w.id===s.selectedWire);if(!w)return el('p',null,'Το καλώδιο αφαιρέθηκε.');
    return el('div',{className:'inspector'},el('div',{className:'selected-info'},'ΑΓΩΓΟΣ  •  ',w.a,' ↔ ',w.b),el('label',null,'Ακροδέκτης Α',el('select',{value:w.a,onChange:e=>this.changeWires(replaceWireEndpoint(s.wires,w.id,'a',e.target.value),'Άλλαξε ο αγωγός — ανανέωση engine.')},...allTerminals().map(t=>el('option',{key:t,value:t},t)))),el('label',null,'Ακροδέκτης Β',el('select',{value:w.b,onChange:e=>this.changeWires(replaceWireEndpoint(s.wires,w.id,'b',e.target.value),'Άλλαξε ο αγωγός — ανανέωση engine.')},...allTerminals().map(t=>el('option',{key:t,value:t},t)))),this.button('× Αφαίρεση αγωγού',this.removeSelected,'danger-outline'));
  }
  if(s.selectedPin){const net=(this.activePreview()==='star'?this.audit().star:this.audit().delta).netOf(s.selectedPin);const nk=netKey(net);return el('div',{className:'inspector'},el('div',{className:'selected-info'},'ΑΚΡΟΔΕΚΤΗΣ  •  '+s.selectedPin),el('label',null,'Πρόσθετη ετικέτα κόμβου',el('input',{value:s.labels[s.selectedPin]||'',placeholder:'π.χ. Φ1 / είσοδος U',onChange:e=>this.patch({labels:{...s.labels,[s.selectedPin]:e.target.value}},true)})),el('small',null,'Η ετικέτα εμφανίζεται στην αναγωγή. Η ηλεκτρική ταυτότητα δεν μεταβάλλεται.'),el('label',null,'Όνομα κοινού ηλεκτρικού κόμβου',el('input',{value:s.netLabels[nk]||'',placeholder:'π.χ. Ν_ΑΣΤΕΡΑ ή Φ_Α',onChange:e=>this.patch({netLabels:{...s.netLabels,[nk]:e.target.value}},true)})),this.button('Ακύρωση επιλογής',()=>this.patch({pending:null,selectedPin:null}),'quiet'));
  }
  return el('p',{className:'muted'},'Επίλεξε καλώδιο ή ακροδέκτη στο σχέδιο. Μπορείς να αλλάξεις τα άκρα του από εδώ ή σύροντάς τα στο SVG.');
 }
 powerSvg(result,mode){const s=this.state,L=s.layout;const v={w:1030/s.zoom.power,h:790/s.zoom.power,x:s.pan.power.x,y:s.pan.power.y};const stateClosed={K1M:s.run==='STAR'||s.run==='DEAD'||s.run==='DELTA'||(s.run==='OFF'&&mode==='preview'),K2M:(s.run==='DELTA'||(s.run==='OFF'&&s.preview==='delta')),K3M:(s.run==='STAR'||(s.run==='OFF'&&s.preview==='star')),F3:s.run!=='TRIP'};
  const activePhase=(t)=>{const r=result.root(t);for(let i=0;i<3;i++)if(r===result.root(PHASES[i]))return colorPhase[i];return null;};
  const portsFor=(name)=>name==='SOURCE'?PHASES:name==='M'?[...STARTS,...ENDS].map(t=>'M.'+t):['a','b'].flatMap(side=>[1,2,3].map(i=>`${name}.${side}${i}`));
  const terminal=(t)=>{const p=terminalPosition(t,L);if(!p)return null;const color=activePhase(t);const show=s.selectedPin===t||s.pending===t;let align=t.startsWith('M.')?(STARTS.some(x=>t==='M.'+x)?-1:1):/\.a/.test(t)?-1:1;
    return el('g',{key:'port-'+t,'data-pin':t,className:'port '+(show?'picked':''),onMouseDown:e=>this.beginPin(e,t,'power'),onTouchStart:e=>this.touchPin(e,t,'power')},
      el('circle',{'data-pin':t,cx:p.x,cy:p.y,r:11,fill:'#0a1b30',stroke:color||'#81a6ba',strokeWidth:2.5}),el('circle',{'data-pin':t,cx:p.x,cy:p.y,r:3.4,fill:color||'#a8dbee'}),
      el('text',{x:p.x+align*15,y:p.y-14,textAnchor:align===-1?'end':'start',className:'pinlabel'},s.labels[t]||t.replace(/^M\./,'').split('.').slice(-1).join('')),el('circle',{'data-pin':t,cx:p.x,cy:p.y,r:23,fill:'transparent',stroke:'none'}));
  };
  const box=(name)=>{const b=L[name],spec=boxSpec[name],short=name==='SOURCE'?'L1 / L2 / L3':name==='M'?'MOTOR 3~':name==='F3'?'ΘΕΡΜΙΚΟ':name;
    return el('g',{key:name,className:'component'},el('rect',{x:b.x,y:b.y,width:spec.w,height:spec.h,rx:15,className:'component-box',onMouseDown:e=>this.beginComponent(e,name,'power')}),
      el('rect',{x:b.x+10,y:b.y+12,width:spec.w-20,height:36,rx:9,fill:name==='M'?'#15384c':name==='SOURCE'?'#302a3c':'#182c45',onMouseDown:e=>this.beginComponent(e,name,'power')}),
      el('text',{x:b.x+spec.w/2,y:b.y+35,textAnchor:'middle',className:'boxtext',onMouseDown:e=>this.beginComponent(e,name,'power')},short),
      name==='M'?el('g',null,...[0,1,2].map(i=>el('g',{key:i},el('rect',{x:b.x+73,y:b.y+rows.M[i]-18,width:56,height:36,rx:12,fill:'#1d3f52',stroke:'#496a81'}),el('path',{d:`M${b.x+83} ${b.y+rows.M[i]-8} q34 8 0 16 q-18 9 0 16`,fill:'none',stroke:'#b8d7eb',strokeWidth:2.5})))):name==='SOURCE'?el('text',{x:b.x+spec.w/2,y:b.y+spec.h-22,textAnchor:'middle',className:'tiny'},'3~ 400 V'):el('g',null,...[0,1,2].map(i=>el('g',{key:i},
       el('line',{x1:b.x+27,y1:b.y+rows[name][i],x2:b.x+spec.w-27,y2:b.y+rows[name][i],stroke:name==='F3'?'#8cad82':stateClosed[name]?'#69dcc8':'#5e7e96',strokeWidth:3,strokeDasharray:stateClosed[name]?'':'5 7'}),
       name==='F3'?el('path',{d:`M${b.x+spec.w/2-11} ${b.y+rows[name][i]-9} l7 9 -7 9 16 0`,stroke:'#e0b976',strokeWidth:2,fill:'none'}):el('circle',{cx:b.x+spec.w/2,cy:b.y+rows[name][i],r:5,fill:stateClosed[name]?'#70dec2':'#66778b'})))),
      name==='K3M'?el('text',{x:b.x+spec.w/2,y:b.y+spec.h-17,textAnchor:'middle',className:'tiny'},'ΚΟΙΝΟΣ ΑΣΤΕΡΑΣ'):null,
      ...portsFor(name).map(terminal));};
  const wires=s.wires.map((w,i)=>{const p=terminalPosition(w.a,L),q=terminalPosition(w.b,L);if(!p||!q)return null;const color=activePhase(w.a)||activePhase(w.b)||'#6b94ad',selected=s.selectedWire===w.id;
    return el('g',{key:w.id,className:'wiregroup'},el('path',{d:wirePath(p,q,i),fill:'none',stroke:'#0b1221',strokeWidth:9,strokeLinejoin:'round',strokeLinecap:'round'}),
      el('path',{d:wirePath(p,q,i),className:'wire'+(selected?' wire-selected':''),stroke:selected?'#ffe9a1':color,strokeWidth:selected?4:2.6,fill:'none'}),
      el('path',{d:wirePath(p,q,i),fill:'none',stroke:'transparent',strokeWidth:16,style:{cursor:'pointer'},onMouseDown:e=>{e.stopPropagation();this.patch({selectedWire:w.id,selectedPin:null,pending:null});}}),
      selected?[el('circle',{key:'a',cx:p.x,cy:p.y,r:10,className:'wire-end',onMouseDown:e=>this.beginWireEndpoint(e,w.id,'a','power')}),el('circle',{key:'b',cx:q.x,cy:q.y,r:10,className:'wire-end',onMouseDown:e=>this.beginWireEndpoint(e,w.id,'b','power')})]:null);
  });
  const wirePreview=s.dragPreview?.scope==='power'&&s.dragPreview.from?el('line',{x1:terminalPosition(s.dragPreview.from,L)?.x,y1:terminalPosition(s.dragPreview.from,L)?.y,x2:s.dragPreview.xy.x,y2:s.dragPreview.xy.y,stroke:'#ffcc7a',strokeDasharray:'7 6',strokeWidth:3}):null;
  const grid=[];for(let x=0;x<1100;x+=30)grid.push(el('line',{key:'vx'+x,x1:x,x2:x,y1:0,y2:790,className:'canvas-grid'}));for(let y=0;y<790;y+=30)grid.push(el('line',{key:'hy'+y,x1:0,x2:1100,y1:y,y2:y,className:'canvas-grid'}));
  return el('svg',{ref:n=>this.svgRefs.power=n,xmlns:'http://www.w3.org/2000/svg',className:'editor-svg',viewBox:`${v.x} ${v.y} ${v.w} ${v.h}`,onWheel:e=>this.canvasWheel('power',e),onTouchStart:e=>this.touchCanvasStart('power',e),onTouchMove:e=>this.touchCanvasMove('power',e),onTouchEnd:()=>{this.touchGesture=null;},onMouseDown:e=>this.canvasDown('power',e),onMouseMove:e=>this.canvasMove('power',e),onMouseUp:e=>this.canvasUp('power',e),onMouseLeave:e=>this.canvasUp('power',e)},
    el('rect',{x:0,y:0,width:1100,height:790,fill:'#101e30'}),el('g',null,...grid),
    el('text',{x:38,y:48,className:'scheme-heading'},'POWER CIRCUIT  •  3 × 400 V'),
    el('text',{x:38,y:73,className:'scheme-sub'},`K1M → F3 → MOTOR   /   K2M Δ   /   K3M Y     [${mode==='dead'?'BREAK BEFORE MAKE':mode==='preview'?'PREVIEW':mode.toUpperCase()}]`),
    el('g',null,...wires),el('g',null,...Object.keys(boxSpec).map(box)),
    // visible star contactor's factory-internal common bar
    el('path',{d:`M${L.K3M.x+boxSpec.K3M.w-13} ${L.K3M.y+68} V${L.K3M.y+194}`,stroke:'#6ee3c3',strokeWidth:5,strokeDasharray:stateClosed.K3M?'':'7 5',opacity:stateClosed.K3M?1:.45,fill:'none'}),el('text',{x:L.K3M.x+boxSpec.K3M.w-22,y:L.K3M.y+228,textAnchor:'end',className:'tiny'},stateClosed.K3M?'U2 = V2 = W2':'εσωτερική μπάρα Υ'),
    ...s.wires.filter(w=>w.id===s.selectedWire).flatMap(w=>['a','b'].map(side=>{const port=terminalPosition(w[side],L);return port?el('circle',{key:'handle'+side,cx:port.x,cy:port.y,r:16,fill:'transparent',stroke:'#ffdf86',strokeWidth:3,cursor:'crosshair',onMouseDown:e=>this.beginWireEndpoint(e,w.id,side,'power')}):null;})),wirePreview,
    el('text',{x:35,y:750,className:'tiny'},'Σημείωση: Η αναπαράσταση των επαφών στην προβολή Υ/Δ είναι ενδεικτική όταν η εκκίνηση δεν έχει ενεργοποιηθεί.'));
 }
 diagramSvg(result){
  const s=this.state;const v={w:900/s.zoom.diagram,h:790/s.zoom.diagram,x:s.pan.diagram.x,y:s.pan.diagram.y};
  const rowsY=[253,378,503];
  const p={};STARTS.forEach((t,i)=>p['M.'+t]={x:310,y:rowsY[i]});
  ENDS.forEach((t,i)=>p['M.'+t]={x:635,y:rowsY[i]});
  const supply={},delta={},star={};
  PHASES.forEach((t,i)=>supply[`F3.b${i+1}`]={x:76,y:rowsY[i]});
  for(let i=0;i<3;i++){delta[`K2M.b${i+1}`]={x:823,y:rowsY[i]};star[`K3M.a${i+1}`]={x:425+i*100,y:646};}
  const pinPos={...p,...supply,...delta,...star};
  const activeNet=t=>result.netOf(t);
  const phaseFor=t=>{const ps=activeNet(t)?.phases||[];return ps.length===1?colorPhase[PHASES.indexOf(ps[0])]:ps.length>1?MACHINE_COLORS.wrong:null;};
  const coordColor=(t)=>phaseFor(t)|| (t.startsWith('K2')?MACHINE_COLORS.delta:t.startsWith('K3')?MACHINE_COLORS.star:'#87b5c9');
  const coils=[['U1','U2','U'],['V1','V2','V'],['W1','W2','W']];
  const coilPath=(x1,x2,y)=>{let d=`M${x1} ${y} L${x1+20} ${y}`;for(let k=0;k<12;k++)d+=` L${x1+25+k*16} ${y+(k%2?18:-18)}`;return d+` L${x2} ${y}`;};
  const safeLabel=(t)=>s.labels[t]||t.replace(/^M\./,'').replace('F3.b','L');
  const terminal=(id,place,kind)=>{const tint=coordColor(id),selected=s.selectedPin===id||s.pending===id;
    const name=id.startsWith('F3.')?`L${id.slice(-1)}`:id.replace('M.','').replace('K2M.','K2M·').replace('K3M.','K3M·');
    return el('g',{key:'terminal'+id,'data-pin':id,className:'machine-port'+(selected?' machine-picked':''),
       onMouseDown:e=>this.beginPin(e,id,'diagram'),onTouchStart:e=>this.touchPin(e,id,'diagram')},
       el('circle',{'data-pin':id,cx:place.x,cy:place.y,r:selected?17:13,fill:'#0d1a2b',stroke:tint,strokeWidth:selected?4:2.5}),
       el('circle',{'data-pin':id,cx:place.x,cy:place.y,r:4.7,fill:tint}),
       el('text',{x:place.x,y:kind==='bottom'?place.y+37:place.y-25,textAnchor:'middle',className:'machine-pinname'},kind==='motor'?safeLabel(id):name),
       kind==='motor'?el('text',{x:place.x,y:place.y+36,textAnchor:'middle',className:'machine-netname'},(s.netLabels[netKey(activeNet(id))]||activeNet(id)?.phases.join('/')||'floating').slice(0,17)):null,
       el('circle',{'data-pin':id,cx:place.x,cy:place.y,r:23,fill:'transparent'}));
  };
  const connectedLeads=s.wires.filter(w=>pinPos[w.a]&&pinPos[w.b]);
  const wireGraphic=(w,i)=>{
    const a=pinPos[w.a],b=pinPos[w.b],chosen=s.selectedWire===w.id;
    const isDelta=/K2M/.test(w.a+w.b),isStar=/K3M/.test(w.a+w.b),isLine=/F3/.test(w.a+w.b);
    const tint=chosen?'#fff4b1':isLine?colorPhase[Number((w.a+w.b).match(/F3\.b([123])/)?.[1]||'1')-1]:isDelta?MACHINE_COLORS.delta:isStar?MACHINE_COLORS.star:'#bb9bff';
    const active=(isDelta&&result.mode==='delta')||(isStar&&result.mode==='star')||isLine||(!isDelta&&!isStar);
    // Route around the stator and around other terminal circles. Geometric line
    // intersections NEVER create electrical joints; only explicit terminal IDs do.
    // Dedicated relay lanes reduce deceptive wire-through-terminal overlaps.
    let d;
    if(isStar){
      const relayName=w.a.startsWith('K3M.')?w.a:w.b;
      const motorName=w.a.startsWith('M.')?w.a:w.b;
      const relay=pinPos[relayName],motor=pinPos[motorName];
      if(relay&&motor){
        const lane=(Number(relayName.match(/([123])$/)?.[1]||1)-1);
        const outsideX=motor.x<=320?244:696+lane*13;
        const lowerY=587+lane*12;
        d=`M${motor.x} ${motor.y} H${outsideX} V${lowerY} H${relay.x} V${relay.y}`;
      }else d=`M${a.x} ${a.y} L${b.x} ${b.y}`;
    }
    else if(isDelta){const lane=(Number((w.a+w.b).match(/K2M\.b([123])/)?.[1]||1)-1),column=731+lane*8;
      const relayName=w.a.startsWith('K2M.')?w.a:w.b,motorName=w.a.startsWith('M.')?w.a:w.b;
      const relay=pinPos[relayName],motor=pinPos[motorName];
      d=relay&&motor?`M${relay.x} ${relay.y} H${column} V${motor.y} H${motor.x}`:`M${a.x} ${a.y} H${column} V${b.y} H${b.x}`;
    }
    else if(isLine){const column=166+i%3*9;d=`M${a.x} ${a.y} H${column} V${b.y} H${b.x}`;}
    else d=`M${a.x} ${a.y} Q${(a.x+b.x)/2} ${(a.y+b.y)/2-34} ${b.x} ${b.y}`;
    return el('g',{key:w.id,className:'machine-wire'+(chosen?' machine-wire-selected':'')},
      el('path',{d,stroke:'#061221',strokeWidth:11,fill:'none',strokeLinejoin:'round',strokeLinecap:'round'}),
      el('path',{d,stroke:tint,strokeWidth:chosen?5.2:3.2,fill:'none',opacity:active?1:.34,strokeLinejoin:'round',strokeLinecap:'round'}),
      el('path',{d,stroke:'transparent',strokeWidth:19,fill:'none',style:{cursor:'pointer'},onMouseDown:e=>{e.stopPropagation();this.patch({selectedWire:w.id,pending:null,selectedPin:null});}}),
      chosen?['a','b'].map(side=>{const z=pinPos[w[side]];return el('circle',{key:side,cx:z.x,cy:z.y,r:12,fill:'#17253d',stroke:'#ffe39b',strokeWidth:3,onMouseDown:e=>this.beginWireEndpoint(e,w.id,side,'diagram')})}):null);
  };
  const guideLines=PHASES.flatMap((phase,i)=>{
    const lead=`F3.b${i+1}`,sourceNet=activeNet(lead),target=`M.${STARTS[i]}`;
    return !s.wires.some(w=>(w.a===lead&&w.b===target)||(w.b===lead&&w.a===target))?[el('path',{key:phase+'ghost',d:`M76 ${rowsY[i]} H310`,fill:'none',stroke:colorPhase[i],strokeWidth:2.1,strokeDasharray:'7 8',opacity:.3})]:[];
  });
  const windingDraw=coils.map(([a,b,n],i)=>{const y=rowsY[i],data=result.branch[i];return el('g',{key:n},
     el('rect',{x:348,y:y-43,width:245,height:86,rx:13,fill:'#10243a',stroke:'#37526a',strokeWidth:1.7}),
     el('path',{d:coilPath(363,567,y),fill:'none',stroke:MACHINE_COLORS[n.toLowerCase()],strokeWidth:3.9,strokeLinecap:'round',strokeLinejoin:'round'}),
     el('text',{x:470,y:y-26,textAnchor:'middle',className:'coil-tag'},`ΤΥΛΙΓΜΑ ${n}  ·  ${a} → ${b}`),
     el('text',{x:470,y:y+35,textAnchor:'middle',className:'coil-reading'},`${fmt(data.voltage,1)} V  |  ${fmt(data.current,1)} A`),
     el('line',{x1:310,y1:y,x2:348,y2:y,stroke:MACHINE_COLORS[n.toLowerCase()],strokeWidth:3.5}),
     el('line',{x1:593,y1:y,x2:635,y2:y,stroke:MACHINE_COLORS[n.toLowerCase()],strokeWidth:3.5}));});
  const starmates=ENDS.every(t=>result.same('M.U2','M.'+t));
  const commonClass=result.mode==='star'?MACHINE_COLORS.star:MACHINE_COLORS.delta;
  const rawDest=(w)=>pinPos[w.a]||pinPos[w.b];
  const dragLine=s.dragPreview?.scope==='diagram'?(()=>{const pr=s.dragPreview;let a=pr.from?pinPos[pr.from]:null;
    if(!a&&pr.id){const w=s.wires.find(w=>w.id===pr.id);if(w)a=pinPos[w[pr.end==='a'?'b':'a']];}
    return a?el('line',{x1:a.x,y1:a.y,x2:pr.xy.x,y2:pr.xy.y,stroke:'#fff2ab',strokeDasharray:'8 5',strokeWidth:3.8,pointerEvents:'none'}):null;})():null;
  return el('svg',{ref:n=>this.svgRefs.diagram=n,xmlns:'http://www.w3.org/2000/svg',className:'editor-svg equivalent-svg machine-canvas',viewBox:`${v.x} ${v.y} ${v.w} ${v.h}`,
      onWheel:e=>this.canvasWheel('diagram',e),onTouchStart:e=>this.touchCanvasStart('diagram',e),onTouchMove:e=>this.touchCanvasMove('diagram',e),onTouchEnd:()=>{this.touchGesture=null;},
      onMouseDown:e=>this.canvasDown('diagram',e),onMouseMove:e=>this.canvasMove('diagram',e),onMouseUp:e=>this.canvasUp('diagram',e),onMouseLeave:e=>this.canvasUp('diagram',e)},
    el('rect',{x:0,y:0,width:900,height:790,fill:'#0c192a'}),
    ...Array.from({length:24},(_,i)=>el('line',{key:i+'grid',x1:i*40,y1:0,x2:i*40,y2:790,stroke:'#1b3348',opacity:.24})),
    el('text',{x:33,y:43,className:'scheme-heading'},'MOTOR TERMINAL / WIRING BENCH'),
    el('text',{x:33,y:67,className:'scheme-sub'},'ΕΞΟΔΟΣ F3 → 6 ΑΚΡΟΔΕΚΤΕΣ ΣΤΑΤΗ → K2M (Δ) / K3M (Υ)'),
    el('g',null,el('rect',{x:262,y:116,width:418,height:463,rx:28,fill:'#14283a',stroke:'#47667d',strokeWidth:2.2}),
      el('rect',{x:286,y:130,width:371,height:60,rx:15,fill:'#1c394d'}),
      el('text',{x:470,y:155,textAnchor:'middle',className:'motor-title'},'M  3~  /  STATOR'),
      el('text',{x:470,y:174,textAnchor:'middle',className:'motor-sub'},s.plate==='400/690'?'ΠΙΝΑΚΙΔΑ  Δ400 / Υ690 V':'ΠΙΝΑΚΙΔΑ  Δ230 / Υ400 V'),
      ...windingDraw),
    el('text',{x:70,y:132,textAnchor:'middle',className:'machine-section'},'ΤΡΟΦΟΔΟΣΙΑ'),
    el('text',{x:70,y:152,textAnchor:'middle',className:'machine-section-small'},'ΜΕΤΑ K1M / F3'),
    el('rect',{x:16,y:194,width:121,height:361,rx:15,fill:'#13293f',stroke:'#33526c'}),
    ...PHASES.map((phase,i)=>el('g',{key:phase},el('rect',{x:31,y:rowsY[i]-55,width:91,height:26,rx:6,fill:colorPhase[i],opacity:.16}),
      el('text',{x:76,y:rowsY[i]-37,textAnchor:'middle',className:'phase-title',fill:colorPhase[i]},phase))),
    el('text',{x:823,y:132,textAnchor:'middle',className:'machine-section'},'K2M  ·  Δ'),
    el('text',{x:823,y:154,textAnchor:'middle',className:'machine-section-small'},'3 ΕΞΟΔΟΙ ΠΡΟΣ ΑΚΡΑ'),
    el('rect',{x:756,y:194,width:134,height:361,rx:15,fill:'#2a2431',stroke:'#75593d'}),
    el('text',{x:523,y:746,textAnchor:'middle',className:'machine-section'},'K3M · Υ'),
    el('text',{x:523,y:759,textAnchor:'middle',className:'machine-section-small'},'ΤΑ 3 ΤΕΛΗ ΠΡΟΣ ΚΟΙΝΟ ΖΥΓΟ'),
    el('rect',{x:348,y:630,width:350,height:103,rx:14,fill:'#153334',stroke:'#3d8e7d'}),
    el('line',{x1:425,y1:694,x2:625,y2:694,stroke:MACHINE_COLORS.star,strokeWidth:5,strokeDasharray:result.mode==='star'?'':'10 7',opacity:result.mode==='star'?.95:.32}),
    ...[425,525,625].map((x,i)=>el('path',{key:'starbar'+i,d:`M${x} 646 V694`,stroke:MACHINE_COLORS.star,strokeWidth:3.1,strokeDasharray:result.mode==='star'?'':'6 7',opacity:result.mode==='star'?.95:.32})),
    el('text',{x:525,y:712,textAnchor:'middle',fill:'#81d7bf',fontSize:11},'K3M · εσωτερική μπάρα b1=b2=b3'),
    ...guideLines,...connectedLeads.map(wireGraphic),
    ...Object.entries(supply).map(([id,pt])=>terminal(id,pt,'source')),
    ...Object.entries(delta).map(([id,pt])=>terminal(id,pt,'delta')),
    ...Object.entries(star).map(([id,pt])=>terminal(id,pt,'bottom')),
    ...Object.entries(p).map(([id,pt])=>terminal(id,pt,'motor')),
    el('text',{x:33,y:767,className:'machine-footer'},`ΠΡΟΒΟΛΗ: ${result.mode==='star'?'ΑΣΤΕΡΑΣ Υ · ΚΛΕΙΣΤΟΣ K3M':'ΤΡΙΓΩΝΟ Δ · ΚΛΕΙΣΤΟΣ K2M'}  |  ${connectedLeads.length} ΟΡΑΤΟΙ ΑΓΩΓΟΙ  |  ${result.healthy?'ΚΟΜΒΟΙ ΕΓΚΥΡΟΙ':'ΑΝΙΧΝΕΥΣΗ ΣΦΑΛΜΑΤΟΣ'}`),
    dragLine);
 }
 topologyPreview(result){
  const healthy=result.healthy,star=result.mode==='star',tone=healthy?'#73e1b7':'#ff8295';
  const netText=(t)=>{const net=result.netOf(t);return {name:this.state.netLabels[netKey(net)]||net?.phases?.join('/')||net?.id||'—',members:(net?.members||[]).filter(x=>x.startsWith('M.')).map(x=>x.replace('M.','')).join(' · ')||'κανένας'};};
  const endpoints=star?['M.U2','M.V2','M.W2']:PHASES;
  const title=healthy?(star?'Υ: κοινός κόμβος στα U2, V2, W2':'Δ: τρεις κόμβοι, με μία αρχή και ένα τέλος σε κάθε φάση'):
    'Η συνδεσμολογία δεν αντιστοιχεί σε έγκυρη σύνδεση '+(star?'αστέρα':'τριγώνου');
  const concept=star?'Στον αστέρα τα άκρα U2/V2/W2 ενώνονται χωρίς να συνδεθούν σε φάση. Κάθε τύλιγμα δέχεται την πολική τάση διά √3.':
    'Στο τρίγωνο κάθε κόμβος συνδέει την αρχή ενός τυλίγματος με το τέλος άλλου. Κάθε τύλιγμα δέχεται ολόκληρη την πολική τάση.';
  const mini=!healthy?el('svg',{viewBox:'0 0 270 170',className:'concept-svg','aria-label':'Πραγματική αντιστοίχιση των άκρων των τυλιγμάτων'},
    el('text',{x:14,y:17,fill:'#ffb2c0',fontSize:11,fontWeight:800},'ΠΡΑΓΜΑΤΙΚΟΙ ΚΟΜΒΟΙ'),
    ...STARTS.map((st,i)=>{const en=ENDS[i],y=48+i*49,
      left=(result.netOf('M.'+st)?.phases||[]).join('/')||result.netOf('M.'+st)?.id||'—',
      right=(result.netOf('M.'+en)?.phases||[]).join('/')||result.netOf('M.'+en)?.id||'—';
      return el('g',{key:st},
       el('circle',{cx:27,cy:y,r:8,fill:'#17304a',stroke:MACHINE_COLORS[st[0].toLowerCase()],strokeWidth:2}),
       el('text',{x:27,y:y-13,textAnchor:'middle',fill:'#e5effc',fontSize:11},st),
       el('path',{d:`M38 ${y} H85 l8 -8 8 16 8 -16 8 16 8 -8 H225`,stroke:MACHINE_COLORS[st[0].toLowerCase()],strokeWidth:2.5,fill:'none'}),
       el('circle',{cx:239,cy:y,r:8,fill:'#17304a',stroke:MACHINE_COLORS[st[0].toLowerCase()],strokeWidth:2}),
       el('text',{x:239,y:y-13,textAnchor:'middle',fill:'#e5effc',fontSize:11},en),
       el('text',{x:35,y:y+17,textAnchor:'start',fill:'#9ac8d9',fontSize:10},left),
       el('text',{x:229,y:y+17,textAnchor:'end',fill:'#9ac8d9',fontSize:10},right));})):star?el('svg',{viewBox:'0 0 270 170',className:'concept-svg','aria-label':'Αναγωγή αστέρα βάσει πραγματικής συνδεσιμότητας'},
    ...[0,1,2].map((i)=>el('g',{key:i},el('path',{d:`M22 ${30+i*53} L81 ${30+i*53} l8 -9 10 18 10 -18 10 18 10 -9 L157 ${30+i*53} L198 83`,stroke:colorPhase[i],strokeWidth:3,fill:'none',strokeLinecap:'round'}),el('text',{x:5,y:26+i*53,fill:colorPhase[i],fontSize:12,fontWeight:800},PHASES[i]))),
    el('circle',{cx:198,cy:83,r:13,fill:'#123632',stroke:tone,strokeWidth:3}),el('text',{x:198,y:88,textAnchor:'middle',fill:'#fff',fontSize:13,fontWeight:800},'S')):
    el('svg',{viewBox:'0 0 270 170',className:'concept-svg','aria-label':'Αναγωγή τριγώνου βάσει πραγματικής συνδεσιμότητας'},
      el('path',{d:'M135 16 L24 153 L248 153 Z',fill:'none',stroke:'#4c6b80',strokeWidth:2}),
      ...[[135,16,24,153],[24,153,248,153],[248,153,135,16]].map(([x,y,xx,yy],i)=>el('g',{key:i},el('line',{x1:x,y1:y,x2:xx,y2:yy,stroke:colorPhase[i],strokeWidth:5,strokeLinecap:'round'}))),
      ...[[135,16],[24,153],[248,153]].map(([x,y],i)=>el('g',{key:i},el('circle',{cx:x,cy:y,r:11,fill:'#193445',stroke:colorPhase[i],strokeWidth:3}),el('text',{x:x+(i===0?0:i===1?-15:15),y:y+(i===0?-14:0),textAnchor:'middle',fill:'#dceaf5',fontSize:12,fontWeight:800},PHASES[i]))));
  const liveFault=[...result.faults,...result.warnings];
  return el('section',{className:'topology-preview '+(healthy?'preview-good':'preview-bad')},
   el('div',{className:'preview-heading'},el('div',null,el('div',{className:'preview-kicker'},'03 / ΖΩΝΤΑΝΗ ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΑΠΟΤΕΛΕΣΜΑΤΟΣ'),el('strong',null,title)),this.badge(healthy?'ΣΩΣΤΗ ΤΟΠΟΛΟΓΙΑ':'ΕΝΤΟΠΙΣΤΗΚΕ ΛΑΘΟΣ',healthy?'teal':'red')),
   el('div',{className:'preview-main'},el('div',{className:'preview-mini'},mini,el('span',null,healthy?'Σχηματική ερμηνεία της σύνδεσης':'Πραγματικές ομάδες κόμβων στα άκρα, όχι ιδανικό Υ/Δ')),
     el('div',{className:'preview-analysis'},el('p',null,concept),
      el('div',{className:'preview-readings'},el('span',null,'ΜΕΣΗ ΤΑΣΗ ΤΥΛΙΓΜΑΤΟΣ',el('b',null,(result.faults.length?'—':fmt(result.windingVoltage,1)+' V'))),
        el('span',null,'ΡΕΥΜΑ ΓΡΑΜΜΗΣ',el('b',null,(result.faults.length?'—':fmt(result.lineCurrent,1)+' A'))),
        el('span',null,'ΡΕΥΜΑ ΤΥΛΙΓΜΑΤΟΣ',el('b',null,(result.faults.length?'—':fmt(result.windingCurrent,1)+' A')))),
      liveFault.length?el('p',{className:'preview-fault'},'⚠ '+liveFault.slice(0,3).join(' · ')+(result.faults.length?' · Οι ενδεικτικές μετρήσεις αποκρύπτονται σε κατάσταση σφάλματος.':'')):el('p',{className:'preview-sound'},'✓ Ο engine επιβεβαιώνει ότι οι αναμενόμενοι κοινoί κόμβοι σχηματίζονται χωρίς απευθείας γεφύρωση φάσεων.'))),
   el('div',{className:'preview-nodes'},...endpoints.map((t,i)=>{const net=netText(t);return el('div',{key:t,className:'preview-node'},el('small',null,star?['U2','V2','W2'][i]:t),el('strong',null,net.name),el('span',null,net.members));})),
   el('p',{className:'preview-disclaimer'},'Η αναγωγή Υ/Δ εξηγεί την κατάσταση που επέλεξες. Η πραγματική συνδεσιμότητα και η διάγνωση προκύπτουν από τους αγωγούς· το σχεδιασμένο σύμβολο δεν αποτελεί απόδειξη ασφάλειας σε πραγματική εγκατάσταση.'));
 }
 renderDynamics(){
  const s=this.state,p=s.params,model=s.live;
  const slip=1-s.speed,starRemoved=starIsDisconnected(s.wires,s.thermal);
  const rated=ratedLoadTorque(s.vl,p),syncRpm=120*p.f/p.poles;
  const currentMode=s.run==='STAR'?'star':'delta';
  const simPoint=motorPoint(slip,currentMode,s.vl,p);
  const chartPhase=(s.bypassStar&&s.run==='STAR')?'OFF':s.run;
  const windowT=Math.max(.16,s.time),wave=calculateTrace(windowT-.12,windowT,.0006,s.speed,chartPhase,s.vl,p);
  const history=s.history;
  const historySeries=(key)=>history.length>1?history.map(x=>[x.time,x[key]]):[[0,0],[.1,0]];
  const maxT=Math.max(3,s.time,s.delay+s.deadTime+1);
  const tSlip=(mode)=>Array.from({length:201},(_,i)=>{const t=i/200;return [t,motorPoint(Math.max(.0005,t),mode,s.vl,p).torque];});
  const tD=tSlip('delta'),tY=tSlip('star'),tMax=Math.max(...tD.map(x=>x[1]))*1.12;
  const z1={r:p.R1,i:p.X1},critical=p.R2/Math.sqrt(p.R1*p.R1+(p.X1+p.X2)*(p.X1+p.X2));
  const desiredLoad=loadTorque(s.speed*4*Math.PI*p.f/p.poles,s.loadPct,s.vl,p,s.loadShape);
  const kv=(name,value,meta)=>el('div',{className:'dyn-kpi'},el('small',null,name),el('strong',null,value),el('span',null,meta));
  const hint=(title,text)=>el('div',{className:'simulation-hint'},el('strong',null,title),el('span',null,text));
  return el('div',{className:'content-page dynamics'},
   el('div',{className:'page-head'},el('div',null,el('div',{className:'eyebrow'},'MOTOR SIMULATION / 03'),el('h1',null,'Κυματομορφές εκκίνησης & καμπύλη ροπής'),el('p',null,'Εκπαιδευτικό ισοδύναμο ασύγχρονου κινητήρα: το φορτίο καθορίζει την επιτάχυνση, η ολίσθηση επηρεάζει τη ροπή και το ρεύμα.')),
    el('div',{className:'head-pills'},this.badge('THEVENIN MODEL','teal'),this.badge('APPROX. TRANSIENTS','amber'))),
   el('section',{className:'panel dyn-settings'},
     el('div',{className:'subhead'},'1 / ΠΑΡΑΜΕΤΡΟΙ ΔΟΚΙΜΗΣ',this.badge(STATUS_LABEL[s.run],s.run==='STAR'?'teal':s.run==='DELTA'?'amber':'')),
     el('div',{className:'dyn-setup-grid'},
       el('div',{className:'dyn-load-slider'},el('label',null,'ΦΟΡΤΙΟ ΑΞΟΝΑ — ',el('strong',null,`${s.loadPct}%`)),el('input',{type:'range',min:0,max:100,step:1,value:s.loadPct,onChange:e=>this.patch({loadPct:+e.target.value})}),el('div',{className:'range-ends'},el('span',null,'0% · χωρίς εξωτερικό φορτίο'),el('span',null,'100% · ονομαστικό φορτίο'))),
       el('label',null,'Μοντέλο φορτίου',el('select',{value:s.loadShape,onChange:e=>this.patch({loadShape:e.target.value})},el('option',{value:'constant'},'Σταθερή ροπή'),el('option',{value:'fan'},'Ανεμιστήρας ~ n²'))),
       el('label',null,'Χρόνος Υ (s)',el('input',{type:'number',min:.2,max:30,step:.2,value:s.delay,onChange:e=>this.patch({delay:Math.max(.2,Math.min(30,+e.target.value||.2))})})),
       el('label',null,'Κριτήριο μεταγωγής',el('select',{value:s.strategy,onChange:e=>this.patch({strategy:e.target.value,run:'OFF',bypassStar:false},true)},el('option',{value:'mounted'},'Μηχανικό χρονικό K3M'),el('option',{value:'independent'},'Ανεξάρτητο KT1'),el('option',{value:'speed'},'Με βάση την ταχύτητα'))),
       el('label',null,'Όριο ταχύτητας (%)',el('input',{type:'number',min:40,max:95,value:s.threshold,onChange:e=>this.patch({threshold:Math.max(40,Math.min(95,+e.target.value||85))})}))
     ),
     el('div',{className:'dyn-actions'},this.button('✳ AUTO: Κανονικό Υ/Δ',()=>this.autoBuild(),'soft'),this.button('✂ Αφαίρεσε τα 3 καλώδια Υ',()=>this.autoBuild('without-star'),'outline'),this.button('⟟ Δες τα καλώδια',()=>this.patch({tab:'workspace',preview:'star'}),'outline'),this.button('▶ START',this.start,'start',['STAR','DEAD','DELTA'].includes(s.run)),this.button('■ STOP',this.stop,'stop')),
     starRemoved?el('div',{className:'dyn-notice danger'},'ΔΟΚΙΜΗ ΧΩΡΙΣ Υ: ο K3M οπλίζει, όμως τα U2/V2/W2 δεν ενώνονται στην πραγματική καλωδίωση. Η μηχανή μένει ακίνητη μέχρι να οπλίσει ο K2M. Αυτό είναι καθυστερημένη απευθείας εκκίνηση Δ, όχι ομαλή εκκίνηση Υ/Δ.'):el('div',{className:'dyn-notice'},'Ο K3M βραχυκυκλώνει (συνδέει στον ίδιο κόμβο) τα U2, V2, W2 όταν οπλίσει. Ο K2M και ο K3M δεν επιτρέπεται να είναι ταυτόχρονα κλειστοί.'),
     el('div',{className:'dyn-kpis'},kv('Ταχύτητα',`${(s.speed*syncRpm).toFixed(0)} rpm`,`${(100*s.speed).toFixed(1)}% της σύγχρονης`),kv('Ολίσθηση',`${(slip*100).toFixed(1)}%`,'s = (nₛ−n)/nₛ'),kv('Ηλ/μαγνητική ροπή',`${(model.torque||0).toFixed(1)} N·m`,'Te(s)'),kv('Ροπή φορτίου',`${(model.load||0).toFixed(1)} N·m`,s.loadShape==='fan'?'T ∝ n²':'T ≈ σταθερή'),kv('Ρεύμα γραμμής',`${(model.current||0).toFixed(1)} A`,'RMS · προσεγγιστικό'),kv('Χρόνος',`${s.time.toFixed(1)} s`,'STAR / DEAD / DELTA')),
     el('div',{className:'dyn-notice'},s.alert)
   ),
   el('div',{className:'dyn-charts'},
    el('section',{className:'panel'},el('div',{className:'subhead'},'2 / ΤΡΙΦΑΣΙΚΑ ΡΕΥΜΑΤΑ i(t)'),el('p',{className:'dyn-small'},'Στιγμιαίες ενδεικτικές ημιτονοειδείς τιμές 50 Hz σε παράθυρο 120 ms. Το πλάτος προκύπτει από το στιγμιαίο s, αλλά ΔΕΝ μοντελοποιούνται DC-offset, κορεσμός, υψηλές αρμονικές ή μεταβατική ροή.'),chartSvg([0,1,2].map(i=>({name:'L'+(i+1),color:colorPhase[i],points:wave.map(row=>[row.t,row.phases[i]])})),{title:'iL1 / iL2 / iL3 [A]',xMin:windowT-.12,xMax:windowT,xLabel:'t [s]',digits:0}),el('div',{className:'chart-legend'},...[0,1,2].map(i=>el('span',{style:{color:colorPhase[i]},key:i},`● L${i+1}`)))),
    el('section',{className:'panel'},el('div',{className:'subhead'},'3 / ΕΚΚΙΝΗΣΗ: ΡΕΥΜΑ, ΡΟΠΗ, ΤΑΧΥΤΗΤΑ'),el('p',{className:'dyn-small'},'Κυματομορφές περιβάλλουσας (RMS/μέση ροπή), από την εξίσωση κίνησης J·dω/dt = Te − TL − Bω.'),chartSvg([{name:'I rms',color:'#62c6e9',points:historySeries('current')}],{title:'Ρεύμα γραμμής [A rms]',xMin:0,xMax:maxT,xLabel:'t [s]',digits:0}),chartSvg([{name:'Te',color:'#ffb66c',points:historySeries('torque')},{name:'Tload',color:'#e889cb',points:historySeries('load')}],{title:'Ηλεκτρομαγνητική ροπή / ροπή φορτίου [N·m]',xMin:0,xMax:maxT,xLabel:'t [s]',digits:0}),chartSvg([{name:'n/nₛ',color:'#72e6bd',points:historySeries('speed').map(([t,z])=>[t,100*z])}],{title:'Στροφές ως % της σύγχρονης',xMin:0,xMax:maxT,minY:0,maxY:100,xLabel:'t [s]',digits:0})),
    el('section',{className:'panel'},el('div',{className:'subhead'},'4 / ΧΑΡΑΚΤΗΡΙΣΤΙΚΗ ΡΟΠΗΣ–ΟΛΙΣΘΗΣΗΣ'),chartSvg([{name:'Δ',color:'#ffbd78',points:tD},{name:'Υ',color:'#72e7c7',points:tY},{name:'T φορτίου',color:'#e18fc9',points:[[0,desiredLoad],[1,desiredLoad]]},{name:'σημείο',color:'#fff3bd',points:[[slip,0],[slip,tMax]]}],{title:'Te (s) και ενδεικτική TL [N·m]',xMin:0,xMax:1,minY:0,maxY:tMax,xLabel:'ολίσθηση s',digits:0}),
      el('div',{className:'chart-legend'},el('span',{style:{color:'#ffbd78'}},'● Δ'),el('span',{style:{color:'#72e7c7'}},'● Υ ≈ TeΔ/3'),el('span',{style:{color:'#e18fc9'}},'● φορτίο'),el('span',{style:{color:'#fff3bd'}},'● τρέχουσα s')),
      hint('Περιοχές λειτουργίας',`Μηδενική ολίσθηση s≈0: n≈nₛ, η ροπή τείνει σε μικρή τιμή. Μέγιστη ροπή γύρω από s≈${critical.toFixed(2)} (προσεγγιστικά). Η κανονική κινητήρια ευσταθής περιοχή βρίσκεται κατά κανόνα στο μικρό s, αριστερά του μέγιστου. Στο s=1 ο δρομέας είναι ακίνητος. Αν Te<TL η μηχανή επιβραδύνεται ή δεν εκκινεί.`)),
    el('section',{className:'panel'},el('div',{className:'subhead'},'5 / ΙΣΟΔΥΝΑΜΟ ΚΥΚΛΩΜΑ ΑΝΑ ΦΑΣΗ'),
     el('svg',{className:'motor-equivalent',viewBox:'0 0 820 290',role:'img','aria-label':'Ισοδύναμο κύκλωμα επαγωγικού κινητήρα ανά φάση'},
      el('rect',{width:820,height:290,rx:13,fill:'#0b1b2a'}),
      el('path',{d:'M80 75 H130 M285 75 H395 M395 75 H730 V232 H80 V177 M80 75 V101',stroke:'#8dcef0',strokeWidth:3,fill:'none'}),
      el('circle',{cx:80,cy:140,r:37,stroke:'#f4bf85',strokeWidth:3,fill:'#172d3e'}),
      el('text',{x:80,y:146,textAnchor:'middle',fill:'#ffdcab',fontSize:18},'Vφ ~'),
      el('path',{d:'M130 75 h10 l10 -12 l10 24 l10 -24 l10 24 l10 -12 h10 l10 0',stroke:'#ffbd84',strokeWidth:3,fill:'none'}),
      el('rect',{x:223,y:57,width:61,height:36,rx:9,stroke:'#77c4e8',fill:'#20374a'}),
      el('text',{x:252,y:80,textAnchor:'middle',fill:'#fff',fontSize:14},'jX₁'),
      el('text',{x:161,y:47,textAnchor:'middle',fill:'#ffce9a',fontSize:14},'R₁'),
      el('circle',{cx:395,cy:75,r:6,fill:'#72e4c8'}),
      el('path',{d:'M395 75 V117',stroke:'#8dcef0',strokeWidth:3}),
      el('rect',{x:366,y:117,width:58,height:56,rx:9,fill:'#204339',stroke:'#71debf'}),
      el('text',{x:395,y:141,textAnchor:'middle',fill:'#b4ffe2',fontSize:15},'jXₘ'),
      el('text',{x:395,y:159,textAnchor:'middle',fill:'#b4ffe2',fontSize:12},'κλάδος'),
      el('path',{d:'M395 173 V232',stroke:'#8dcef0',strokeWidth:3}),
      el('path',{d:'M395 75 H595 V106',stroke:'#8dcef0',strokeWidth:3,fill:'none'}),
      el('rect',{x:555,y:106,width:80,height:44,rx:9,stroke:'#ffbd84',fill:'#3b3140'}),
      el('text',{x:595,y:134,textAnchor:'middle',fill:'#ffdaa9',fontSize:16},'R₂′/s'),
      el('path',{d:'M595 150 V172',stroke:'#8dcef0',strokeWidth:3}),
      el('rect',{x:558,y:172,width:74,height:42,rx:9,stroke:'#83bbee',fill:'#213a55'}),
      el('text',{x:595,y:198,textAnchor:'middle',fill:'#c5e5ff',fontSize:16},'jX₂′'),
      el('path',{d:'M595 214 V232',stroke:'#8dcef0',strokeWidth:3}),
      el('text',{x:410,y:267,textAnchor:'middle',fill:'#a2c3d7',fontSize:13},'Σταθερή συχνότητα · εκπαιδευτικό ανά φάση ισοδύναμο')
     ),
     el('div',{className:'dyn-equation'},'Tₑ(s) = 3·|Vth|²·(R₂′/s) / {ωs · [(Rth + R₂′/s)² + (Xth + X₂′)²]}'),
     el('div',{className:'dyn-inputs'},...[
       ['R1','R₁ (Ω)',.1,10,.05],['X1','X₁ (Ω)',.1,15,.05],['R2','R₂′ (Ω)',.1,10,.05],['X2','X₂′ (Ω)',.1,15,.05],['Xm','Xₘ (Ω)',5,300,1],['J','J (kg·m²)',.1,30,.05]
     ].map(([k,label,min,max,step])=>el('label',{key:k},label,el('input',{type:'number',min,max,step,value:p[k],onChange:e=>this.patch({params:{...p,[k]:Math.max(min,Math.min(max,+e.target.value||min))},run:'OFF'})})))),
     el('p',{className:'dyn-small'},`Σύγχρονη ταχύτητα nₛ = 120·f/p = ${syncRpm.toFixed(0)} rpm (${p.poles} πόλοι, ${p.f} Hz). Ονομαστική ροπή αναφοράς στο s=4,5% ≈ ${rated.toFixed(1)} N·m. Οι παράμετροι είναι ενδεικτικές, όχι στοιχεία συγκεκριμένου κινητήρα.`),
     this.button('↻ Επαναφορά παραμέτρων κινητήρα',()=>this.patch({params:{...MOTOR_DEFAULTS},run:'OFF'}),'outline')
    )
   ),
   el('div',{className:'safety-footer'},'⚠ Οι στιγμιαίες κυματομορφές βασίζονται σε μεταβαλλόμενο πλάτος ημιτονοειδούς, όχι σε πλήρη ηλεκτρομαγνητική επίλυση. Η μέθοδος δεν προβλέπει ακριβείς αιχμές, ρεύματα σφάλματος, θερμική προστασία ή πραγματική συμμόρφωση εγκατάστασης. Μη χρησιμοποιηθεί για διαστασιολόγηση ή εργασία υπό τάση.')
  );
 }

 renderControl(){const s=this.state,active=s.run==='STAR'||s.run==='DELTA'||s.run==='DEAD',status={K1M:active,K2M:s.run==='DELTA',K3M:s.run==='STAR',K4M:s.strategy==='mounted'&&(s.run==='DEAD'||s.run==='DELTA'),KT1:s.strategy==='independent'&&active};
  const box=(name,contacts,detail)=>el('div',{className:'relay-box',key:name},el('div',{className:'relay-heading'},el('strong',null,name),this.badge(status[name]?'ΟΠΛΙΣΜΕΝΟ':'ΑΝΕΝΕΡΓΟ',status[name]?'teal':'')),el('p',null,detail),el('div',{className:'relay-contact-list'},...contacts.map((c,i)=>el('div',{key:i,className:'contact-row'},el('span',{className:'contact-terminal'},c[0]),el('span',{className:'contact-symbol '+(status[name]?'lit':'')},c[1].startsWith('NO')?'—o/ o—':'—o\\o—'),el('span',{className:'contact-terminal'},c[2]),el('span',{className:'contact-type'},c[3]||c[1])))));
  return el('div',{className:'content-page'},el('div',{className:'page-head'},el('div',null,el('div',{className:'eyebrow'},'CONTROL & INTERLOCK  /  02'),el('h1',null,'Κουτιά ρελέ & χρονισμός'),el('p',null,'Συμπληρωματική απεικόνιση της λογικής ελέγχου. Δεν αποτελεί ακόμη επιλυτή αυθαίρετου ladder circuit.'))),
    el('div',{className:'panel'},el('div',{className:'subhead'},'ΣΤΡΑΤΗΓΙΚΗ ΜΕΤΑΓΩΓΗΣ'),el('div',{className:'strategy-grid'},...[
       ['mounted','Μηχανικό χρονικό K3M','Το μπλοκ χρόνου δεν έχει πηνίο. Ενεργοποιείται μηχανικά από K3M. Το K4M διατηρεί την ολοκλήρωση της μεταγωγής.'],
       ['independent','Ανεξάρτητο χρονικό KT1','Ανεξάρτητο πηνίο A1/A2, με NC/NO χρονικές επαφές.'],
       ['speed','Έλεγχος ταχύτητας','Η εντολή Δ ακολουθεί τη λογική n/nₛ ≥ όριο, με μανδάλωση και νεκρό χρόνο.']].map(([id,title,text])=>el('button',{className:'strategy '+(s.strategy===id?'picked':''),key:id,onClick:()=>this.patch({strategy:id,run:'OFF',time:0,speed:0},true)},el('strong',null,title),el('span',null,text))))),
    this.renderControlSchematic(),
    el('div',{className:'workspace-lower'},el('section',{className:'panel'},el('div',{className:'subhead'},'ΡΕΛΕ & ΒΟΗΘΗΤΙΚΕΣ ΕΠΑΦΕΣ'),el('div',{className:'relays-grid'},
       box('K1M',[['13','NO','14'],['21','NC','22']],'Κύριος επαφέας · αυτοσυγκράτηση'),
       box('K2M',[['13','NO','14'],['21','NC','22']],'Δ · ηλεκτρική μανδάλωση με K3M'),
       box('K3M',[['13','NO','14'],['21','NC','22'],['T15','NC (delay)','T16','Χρονική NC'],['T15','NO (delay)','T18','Χρονική NO']],'Υ · 2 βοηθητικές + 2 χρονικές επαφές (4 συνολικά)'),
       box('K4M',[['13','NO','14'],['21','NC','22']],'Βοηθητική μνήμη για τη μηχανικά χρονιζόμενη παραλλαγή'),
       s.strategy==='independent'?box('KT1',[['15','NC','16'],['15','NO','18']],'Ξεχωριστή τροφοδοσία A1/A2 και δύο χρονικές επαφές'):null),
       el('div',{className:'note'},'Το χρονικό πρόσθετο του K3M αλλάζει κατάσταση αφού οπλίσει ο K3M. Η ακριβής χρονική συμπεριφορά επιστροφής εξαρτάται από το επιλεγμένο κατασκευαστικό στοιχείο.')),
       el('section',{className:'panel'},el('div',{className:'subhead'},'ΠΡΟΣΟΜΟΙΩΣΗ ΚΑΙ ΚΡΙΤΗΡΙΑ'),el('div',{className:'field-grid'},el('label',null,'Χρόνος Υ (s)',el('input',{type:'number',min:.2,max:30,step:.2,value:s.delay,onChange:e=>this.patch({delay:Math.max(.2,Number(e.target.value))})})),el('label',null,'Νεκρός χρόνος (s)',el('input',{type:'number',min:.05,max:3,step:.05,value:s.deadTime,onChange:e=>this.patch({deadTime:Math.max(.05,Number(e.target.value))})})),el('label',null,'Όριο n/nₛ (%)',el('input',{type:'number',min:40,max:95,value:s.threshold,onChange:e=>this.patch({threshold:Math.max(40,Math.min(95,Number(e.target.value)))})}))),
         el('div',{className:'big-reading'},el('strong',null,Math.round(s.speed*100)+'%'),el('small',null,'ενδεικτική ταχύτητα n/nₛ'),el('div',{className:'progress-line'},el('span',{style:{width:(s.speed*100)+'%'}}))),
         el('div',{className:'runbar'},this.button('▶ START',this.start,'start'),this.button('■ STOP',this.stop,'stop'),this.button('ϟ TRIP',this.trip,'outline')),el('p',{className:'note'},'Το μοντέλο επιτάχυνσης είναι πρώτης τάξης, εκπαιδευτικό. Δεν προσομοιώνει μαγνητική ροή, ολίσθηση, ροπή φορτίου ή μεταβατικά ρεύματα.'))));
 }
 renderControlSchematic(){
   const s=this.state,active=['STAR','DEAD','DELTA'].includes(s.run),star=s.run==='STAR',delta=s.run==='DELTA';
   const ST='#77e2c7',AM='#f8be7d',OFF='#547187',text=(x,y,t,cls='ladder-label')=>el('text',{x,y,className:cls,textAnchor:'middle'},t);
   const wire=(x1,y1,x2,y2,on=false)=>el('path',{d:`M${x1} ${y1} L${x2} ${y2}`,fill:'none',stroke:on?ST:'#577d95',strokeWidth:on?3.5:2.1,strokeLinecap:'round'});
   const block=(x,y,w,title,kind='NO',energized=false)=>el('g',{key:title+y},
     el('rect',{x,y:y-20,width:w,height:41,rx:8,fill:energized?'#18483f':'#1a3044',stroke:energized?ST:'#45667d',strokeWidth:1.7}),
     el('text',{x:x+w/2,y:y-3,textAnchor:'middle',className:'ladder-text'},title),
     el('text',{x:x+w/2,y:y+11,textAnchor:'middle',className:'ladder-tiny'},kind));
   const controlMode=s.strategy==='mounted'?'K3M MECHANICAL TIMER':s.strategy==='independent'?'KT1 ON-DELAY': 'n/nₛ ≥ '+s.threshold+'%';
   return el('section',{className:'panel control-schematic'},el('div',{className:'subhead'},'ΕΝΔΕΙΚΤΙΚΗ ΚΑΛΩΔΙΩΣΗ ΚΥΚΛΩΜΑΤΟΣ ΕΛΕΓΧΟΥ',this.badge(controlMode,'blue')),
      el('svg',{viewBox:'0 0 1100 420',className:'ladder-svg',xmlns:'http://www.w3.org/2000/svg'},
        el('rect',{width:1100,height:420,rx:14,fill:'#0e1e30'}),
        text(40,48,'L+', 'ladder-label'),text(1060,48,'0V','ladder-label'),
        ...[95,245,344].map(y=>wire(40,y,1060,y,false)),
        block(80,95,118,'STOP','NC',true),block(242,95,115,'F3','NC',s.run!=='TRIP'),block(400,95,118,'START','NO',active),block(750,95,156,'K1M COIL','A1 / A2',active),
        el('path',{d:'M378 95 V162 H420',stroke:'#6989a1',strokeWidth:2,fill:'none'}),block(420,162,145,'K1M HOLD','NO',active),el('path',{d:'M565 162 H575 V95',stroke:active?ST:'#6989a1',strokeWidth:2,fill:'none'}),
        block(110,245,155,'K1M AUX','NO',active),block(345,245,155,'K2M AUX','NC',!delta),block(584,245,160,s.strategy==='mounted'?'K3M TIMER':s.strategy==='independent'?'KT1 TIMER':'SPEED LOGIC','NC → Y',star),block(827,245,166,'K3M COIL','STAR',star),
        block(110,344,155,'K1M AUX','NO',active),block(345,344,155,'K3M AUX','NC',!star),block(584,344,160,s.strategy==='mounted'?'K4M MEMORY':s.strategy==='independent'?'KT1 TIMER':'SPEED LOGIC','NO → Δ',delta),block(827,344,166,'K2M COIL','DELTA',delta),
        s.strategy==='mounted'?el('g',null,
           el('path',{d:'M911 224 V184 H638 V222',fill:'none',stroke:'#ffcf8b',strokeWidth:2,strokeDasharray:'7 6'}),
           text(784,177,'ΜΗΧΑΝΙΚΗ ΖΕΥΞΗ K3M → ΧΡΟΝΙΚΟ','ladder-special')):null,
        ...[95,245,344].flatMap(y=>[el('circle',{cx:40,cy:y,r:5,fill:AM}),el('circle',{cx:1060,cy:y,r:5,fill:'#7eacbf'})]),
        text(550,395,'ΛΟΓΙΚΟ ΣΧΗΜΑ ΕΠΙΔΕΙΞΗΣ · ΟΙ ΕΠΑΦΕΣ NO/NC ΚΑΙ Η ΠΑΡΟΥΣΙΑ ΤΑΣΗΣ ΔΕΝ ΕΠΙΛΥΟΝΤΑΙ ΑΠΟ ΕΛΕΥΘΕΡΗ ΚΑΛΩΔΙΩΣΗ.','ladder-caption')
      ));
 }
 renderQuiz(){const s=this.state,q=QUIZ[s.quizIndex],answer=s.answers[q.id],correct=Object.entries(s.answers).filter(([id,a])=>QUIZ[Number(id)-1]?.correct===a).length,total=Object.keys(s.answers).length;
   return el('div',{className:'content-page'},el('div',{className:'page-head'},el('div',null,el('div',{className:'eyebrow'},'TRAINING MODE / 03'),el('h1',null,'Εξάσκηση & αξιολόγηση'),el('p',null,'Η ίδια τράπεζα 36 ερωτήσεων, με επεξηγήσεις σωστών και λανθασμένων απαντήσεων.'))),
     el('div',{className:'quiz-shell'},el('div',{className:'quiz-top'},this.badge(`${s.quizIndex+1} / ${QUIZ.length}`,'blue'),this.badge(q.category,'teal'),el('span',null,`${correct} σωστές / ${total} απαντήσεις`)),
     el('div',{className:'quiz-progress'},el('span',{style:{width:total/QUIZ.length*100+'%'}})),el('h2',{className:'question'},q.prompt),
     el('div',{className:'option-list'},...q.options.map((opt,i)=>el('button',{key:i,onClick:()=>this.patch({answers:{...s.answers,[q.id]:i}}),className:'option '+(answer===i?'marked ':'')+(answer!==undefined&&s.reveal?(q.correct===i?'answer-correct':answer===i?'answer-wrong':''):'')},el('span',{className:'option-letter'},'ΑΒΓΔ'[i]),opt))),
     s.reveal&&answer!==undefined?el('div',{className:'quiz-explanation'},el('strong',null,answer===q.correct?'✓ Σωστή απάντηση':'✕ Λάθος απάντηση'),el('p',null,q.why)):null,
     el('div',{className:'quiz-nav'},this.button('← Προηγούμενη',()=>this.patch({quizIndex:(s.quizIndex+QUIZ.length-1)%QUIZ.length}),'outline'),this.button('Επόμενη →',()=>this.patch({quizIndex:(s.quizIndex+1)%QUIZ.length}),'primary'),this.button('⇩ CSV αναφορά',()=>this.exportQuiz('csv'),'quiet'),this.button('⇩ JSON',()=>this.exportQuiz('json'),'quiet')),
     el('label',{className:'checkbox-label'},el('input',{type:'checkbox',checked:s.reveal,onChange:e=>this.patch({reveal:e.target.checked})}),'Εμφάνιση εξήγησης μετά την απάντηση')));
 }
 exportQuiz=(type)=>{const s=this.state,rows=QUIZ.map(q=>({id:q.id,category:q.category,question:q.prompt,answer:s.answers[q.id]===undefined?'':q.options[s.answers[q.id]],correct:q.options[q.correct],result:s.answers[q.id]===undefined?'unanswered':s.answers[q.id]===q.correct?'correct':'wrong',explanation:q.why}));
  if(type==='json')downloadText('yd-lab-training.json',JSON.stringify({date:new Date().toISOString(),rows},null,2),'application/json');
  else {const cols=['id','category','question','answer','correct','result','explanation'];const csv=['\ufeff'+cols.join(';'),...rows.map(r=>cols.map(k=>'"'+String(r[k]).replace(/"/g,'""')+'"').join(';'))].join('\r\n');downloadText('yd-lab-training.csv',csv,'text/csv;charset=utf-8');}
 };
 renderHelp(){return el('div',{className:'content-page'},el('div',{className:'page-head'},el('div',null,el('div',{className:'eyebrow'},'DOCUMENTATION / 04'),el('h1',null,'Πώς λειτουργεί ο schematic editor'),el('p',null,'Διαφανές μοντέλο σύνδεσης, υπολογισμών και ασφαλούς εκπαίδευσης.'))),
 el('div',{className:'help-grid'},...[
 ['01','Ξεκίνα από πρότυπο ή κενό','Το έτοιμο κύκλωμα περιέχει 18 καλώδια. Με το κενό κύκλωμα μπορείς να το σχεδιάσεις από την αρχή.'],
 ['02','Σύνδεσε ακροδέκτες','Κλικ σε πρώτο και δεύτερο κυκλικό port ή drag μεταξύ ports. Κλικ σε καλώδιο για επιλογή και αλλαγή άκρου. Delete αφαιρεί.'],
 ['03','Zoom και pan','Με τη ροδέλα κάνεις zoom. Με σύρσιμο σε κενό σημείο μετακινείς τον καμβά. Σύρε το σώμα εξαρτήματος για άλλη θέση.'],
 ['04','Το Υ/Δ προκύπτει από γράφο','Union-find ομαδοποιεί καλώδια και κλειστές επαφές. Τα τυλίγματα είναι πεπερασμένες εμπεδήσεις, όχι βραχυκυκλώματα.'],
 ['05','Αλλαγή από τη μικρή όψη','Σύρε ή σύνδεσε τα K2M.b1–b3 σε U2/V2/W2: αντικαθίσταται αντίστοιχη φυσική ακμή στην αριστερή όψη.'],
 ['06','Συνειδητή ανίχνευση λαθών','Ο engine εντοπίζει γεφυρώσεις φάσεων, παράκαμψη τυλιγμάτων, ελλιπή Υ και λανθασμένους κόμβους Δ. Μπλοκάρει το START.'],
 ['07','Ρελέ και χρονικό','K3M: δύο δικές του βοηθητικές και δύο χρονικές επαφές από μηχανικό πρόσθετο. K4M εκπαιδευτική μνήμη ή ανεξάρτητο KT1 ή κριτήριο ταχύτητας.'],
 ['08','AUTO Υ/Δ','Η Αυτόματη Κατασκευή δημιουργεί τις 18 συνδέσεις. Με το κουμπί Χωρίς κλάδο Υ αφαιρούνται οι 3 αγωγοί προς K3M. Το χρονικό οπλίζει με K3M, αλλά η μηχανή τροφοδοτείται μόνο όταν κλείσει το Δ.'],
 ['09','Θέση F3','F3 στη γραμμή: ρύθμιση Iₙ. F3 εντός βρόχου Δ: περίπου 0,58 Iₙ. Η αλλαγή προτείνει νέο πρότυπο και επανακαλωδιώνει. Απαιτείται πραγματικός έλεγχος προστασιών κατασκευαστή.'],
 ['10','Ροπή και ολίσθηση','Η καρτέλα Κυματομορφές υπολογίζει προσεγγιστικά ρεύμα/ροπή ανά ολίσθηση, προσθέτει φορτίο 0–100% και ολοκληρώνει εξίσωση J·dω/dt = Te − TL − Bω. Ενδέχεται να μη μπορεί να επιταχύνει σε Υ.'],
 ['11','Αποτελέσματα και αρχεία','SVG κάθε όψης και JSON συνδεσμολογίας. '+(HAS_QUIZ?'Η πλήρης έκδοση δίνει και CSV/JSON της εξάσκησης.':'Η δημόσια έκδοση δεν περιλαμβάνει ερωτήσεις.')+' Λειτουργεί τοπικά χωρίς backend.']].map(([number,title,body])=>el('section',{className:'panel help-card',key:number},el('span',{className:'help-number'},number),el('h3',null,title),el('p',null,body)))),
 el('div',{className:'safety-footer'},el('strong',null,'Περιορισμός μοντέλου: '),'Ο editor ελέγχει την τοπολογία και υπολογίζει συμμετρικά ρεύματα με σταθερή εμπέδηση. Η καρτέλα Κυματομορφές χρησιμοποιεί ξεχωριστό εκπαιδευτικό ισοδύναμο ανά φάση, χωρίς πλήρη ηλεκτρομαγνητική μεταβατική επίλυση, πραγματικές καμπύλες θερμικού, βιομηχανικά interlocks ή έλεγχο IEC συμμόρφωσης. Μόνο για εκπαιδευτική χρήση.'));
 }
}
ReactDOM.render(h(App),document.getElementById('root'));
