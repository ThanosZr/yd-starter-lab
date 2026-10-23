/* Shared responsive virtual oscilloscope: X/Y zoom, pan, cursor, dual-pointer pinch.
   Visualizer only: values are taken from the simulation engine. */
const scEl=(tag,props,...children)=>React.createElement(tag,props,...children.flat(Infinity));
let SCOPE_SEQ=0;
class ScopeChart extends React.Component{
 constructor(props){super(props);this.state={zoomX:1,zoomY:1,shiftX:0,shiftY:0,cursor:null,fullscreen:false};this.pointers=new Map();this.last=null;this.svg=null;this.uid='osc-'+(++SCOPE_SEQ);}
 componentDidMount(){
   // React 16 bundled in this offline application predates React synthetic Pointer Events.
   // Bind native Pointer Events for real mouse/touch/pen pan and two-finger pinch.
   const svg=this.svg;if(!svg)return;
   const on={pointerdown:e=>this.down(e),pointermove:e=>this.move(e),pointerup:e=>this.up(e),pointercancel:e=>this.up(e),wheel:e=>this.wheel(e)};
   for(const [name,fn] of Object.entries(on))svg.addEventListener(name,fn,{passive:false});
   this.nativeHandlers=on;
 }
 componentWillUnmount(){if(this.svg&&this.nativeHandlers)for(const [name,fn] of Object.entries(this.nativeHandlers))this.svg.removeEventListener(name,fn);}
 domain(){const o=this.props.options||{},lines=this.props.series||[];const xs=lines.flatMap(l=>l.points.map(p=>p[0])).filter(Number.isFinite);const ys=lines.flatMap(l=>l.points.map(p=>p[1])).filter(Number.isFinite);const minX=o.xMin??Math.min(0,...xs),maxX=o.xMax??Math.max(1,...xs);let minY=o.minY??Math.min(0,...ys),maxY=o.maxY??Math.max(1,...ys);if(!Number.isFinite(minY)||!Number.isFinite(maxY)||minY===maxY){minY=-1;maxY=1}const midX=(minX+maxX)/2+this.state.shiftX,spanX=(maxX-minX)/this.state.zoomX,midY=(minY+maxY)/2+this.state.shiftY,spanY=(maxY-minY)/this.state.zoomY;return{x0:midX-spanX/2,x1:midX+spanX/2,y0:midY-spanY/2,y1:midY+spanY/2,spanX,spanY};}
 zoom(axis,f){this.setState(s=>({...s,zoomX:axis==='x'?Math.max(.25,Math.min(90,s.zoomX*f)):s.zoomX,zoomY:axis==='y'?Math.max(.25,Math.min(40,s.zoomY*f)):s.zoomY}));}
 reset(){this.setState({zoomX:1,zoomY:1,shiftX:0,shiftY:0,cursor:null});}
 goEdge(edge){const o=this.props.options||{},d=this.domain();const min=o.xMin??0,max=o.xMax??Math.max(1,d.x1);const globalCenter=(min+max)/2;this.setState({shiftX:(edge==='start'?min+d.spanX/2:max-d.spanX/2)-globalCenter});}
 pt(e){const r=this.svg?.getBoundingClientRect();if(!r)return{x:0,y:0};return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
 down(e){try{this.svg?.setPointerCapture?.(e.pointerId)}catch{}this.pointers.set(e.pointerId,this.pt(e));this.last=this.pt(e);}
 move(e){if(!this.pointers.has(e.pointerId)){return}const a=this.pointers.get(e.pointerId),b=this.pt(e);if(this.pointers.size===1){const d=this.domain();this.setState(s=>({shiftX:s.shiftX-(b.x-a.x)*d.spanX,shiftY:s.shiftY+(b.y-a.y)*d.spanY,cursor:b.x}));}else if(this.pointers.size===2){const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)?.[1];if(other){const oldX=Math.max(.003,Math.abs(other.x-a.x)),oldY=Math.max(.003,Math.abs(other.y-a.y)),newX=Math.max(.003,Math.abs(other.x-b.x)),newY=Math.max(.003,Math.abs(other.y-b.y));this.setState(s=>({zoomX:Math.min(90,Math.max(.25,s.zoomX*newX/oldX)),zoomY:Math.min(40,Math.max(.25,s.zoomY*newY/oldY))}));}}this.pointers.set(e.pointerId,b);}
 up(e){this.pointers.delete(e.pointerId);if(!this.pointers.size)this.last=null;}
 wheel(e){e.preventDefault();this.zoom(e.shiftKey?'y':'x',e.deltaY<0?1.22:1/1.22);}
 render(){const {series:rawSeries=[],options={}}=this.props,d=this.domain();const series=typeof options.viewSeries==='function'?options.viewSeries(d):rawSeries;const W=980,H=335,p={l:70,r:20,t:27,b:40},L=p.l,R=W-p.r,T=p.t,B=H-p.b;const xx=x=>L+(x-d.x0)/(d.x1-d.x0)*(R-L),yy=y=>B-(y-d.y0)/(d.y1-d.y0)*(B-T);const uid=this.uid,lines=series.map((item,i)=>{let steps='',drawing=false;for(const pt of item.points){if(!Number.isFinite(pt[1])||pt[0]<d.x0-d.spanX*.06||pt[0]>d.x1+d.spanX*.06){drawing=false;continue}steps+=(drawing?'L':'M')+xx(pt[0]).toFixed(1)+','+yy(pt[1]).toFixed(1)+' ';drawing=true;}return scEl('path',{key:i,d:steps,fill:'none',stroke:item.color||'#67d5de',strokeWidth:item.width||2,strokeLinecap:'round',opacity:item.opacity||1})});
 const curs=this.state.cursor!==null?d.x0+Math.max(0,Math.min(1,this.state.cursor))*d.spanX:null;
 const samples=curs===null?[]:series.map(s=>{let nearest=null,dist=Infinity;for(const pt of s.points){const dx=Math.abs(pt[0]-curs);if(dx<dist){dist=dx;nearest=pt}}return{name:s.name||'Trace',value:nearest?.[1],color:s.color};});
 const button=(text,fun,title)=>scEl('button',{type:'button',className:'scope-btn',onClick:fun,title},text);
 return scEl('div',{className:'scope '+(this.state.fullscreen?'scope-expanded':'')},
 scEl('div',{className:'scope-toolbar'},scEl('span',{className:'scope-title'},'▦ ',options.title||'Oscilloscope'),scEl('div',{className:'scope-actions'},button('X+',()=>this.zoom('x',1.5),'Χρονική μεγέθυνση'),button('X−',()=>this.zoom('x',1/1.5),'Χρονική σμίκρυνση'),button('Y+',()=>this.zoom('y',1.5),'Κατακόρυφη μεγέθυνση'),button('Y−',()=>this.zoom('y',1/1.5),'Κατακόρυφη σμίκρυνση'),button('⟵ t₀',()=>this.goEdge('start'),'Στην αρχή της καταγραφής'),button('tₑ ⟶',()=>this.goEdge('end'),'Στο τέλος της καταγραφής'),button('⌖',()=>this.reset(),'Επαναφορά'),button(this.state.fullscreen?'⇲':'⛶',()=>this.setState({fullscreen:!this.state.fullscreen}),'Μεγέθυνση πεδίου'))),
 scEl('svg',{ref:r=>this.svg=r,viewBox:`0 0 ${W} ${H}`,className:'scope-screen',style:{touchAction:'none'},role:'img','aria-label':options.title||'Oscilloscope chart',onDoubleClick:()=>this.reset()},
 scEl('defs',null,scEl('clipPath',{id:uid},scEl('rect',{x:L,y:T,width:R-L,height:B-T}))),scEl('rect',{width:W,height:H,rx:8,fill:'#061522'}),
 ...Array.from({length:9},(_,i)=>{const x=L+(R-L)*i/8;return scEl('g',{key:'v'+i},scEl('line',{x1:x,x2:x,y1:T,y2:B,stroke:'#24475a',strokeDasharray:i===4?'':'2 6'}),scEl('text',{x,y:H-14,fill:'#aac2d5',fontSize:12,textAnchor:'middle'},(d.x0+d.spanX*i/8).toFixed(d.spanX<.1?4:2)))}),
 ...Array.from({length:7},(_,i)=>{const y=T+(B-T)*i/6;return scEl('g',{key:'h'+i},scEl('line',{x1:L,x2:R,y1:y,y2:y,stroke:'#24475a',strokeDasharray:i===3?'':'2 6'}),scEl('text',{x:63,y:y+4,fill:'#9ac1ce',fontSize:12,textAnchor:'end'},(d.y1-d.spanY*i/6).toFixed(d.spanY<2?2:1)))}),
 scEl('g',{clipPath:`url(#${uid})`},...lines,options.playhead!==undefined?scEl('line',{x1:xx(options.playhead),x2:xx(options.playhead),y1:T,y2:B,stroke:'#ff8c72',strokeWidth:2.4,strokeDasharray:'4 5'}):null,curs===null?null:scEl('line',{x1:xx(curs),x2:xx(curs),y1:T,y2:B,stroke:'#f7d78b',strokeWidth:1.6,strokeDasharray:'6 4'})),
 scEl('text',{x:R-5,y:17,textAnchor:'end',fill:'#9bb5c8',fontSize:12},options.xLabel||'t [s]')),
 scEl('div',{className:'scope-readout'},scEl('span',null,`TIME / DIV ${(d.spanX/8).toPrecision(3)} · Y / DIV ${(d.spanY/6).toPrecision(3)}`),curs===null?scEl('span',null,'Drag: PAN · pinch: ZOOM · Shift + wheel: Y'):scEl('span',null,`Cursor x=${curs.toFixed(5)}  `+samples.map(v=>`${v.name}: ${Number(v.value).toFixed(2)}`).join(' · '))),
 scEl('div',{className:'scope-key'},...series.map((s,i)=>scEl('span',{key:i,style:{color:s.color}},'● '+(s.name||'Trace')))));
 }
}


/* Discrete harmonic spectrum: Fourier RMS bins displayed as individual rounded
   spectral lobes. The dome is ONLY a bar glyph, not a continuous interpolation
   or spectral leakage between harmonic frequencies. */
class HarmonicSpectrum extends React.Component {
 constructor(props){super(props);this.state={xUnit:'order',norm:'fundamental',includeFundamental:true,maxOrder:25,zoomX:1,zoomY:1,panH:0,selected:5};this.svg=null;this.drag=null;this.touches=new Map();}
 componentDidMount(){this.wheelListener=e=>{e.preventDefault();this.setState(s=>({zoomX:Math.max(1,Math.min(20,s.zoomX*(e.deltaY<0?1.25:.8)))}))};this.svg?.addEventListener('wheel',this.wheelListener,{passive:false});this.nativePointer={pointerdown:e=>this.start(e),pointermove:e=>this.move(e),pointerup:e=>this.end(e),pointercancel:e=>this.end(e)};for(const [key,handler] of Object.entries(this.nativePointer))this.svg?.addEventListener(key,handler,{passive:false});}
 componentWillUnmount(){this.svg?.removeEventListener('wheel',this.wheelListener);for(const [key,handler] of Object.entries(this.nativePointer||{}))this.svg?.removeEventListener(key,handler);}
 xDomain(){const s=this.state,max=s.maxOrder,span=max/s.zoomX,mid=max/2+s.panH;return{lo:Math.max(0,Math.min(max-span,mid-span/2)),hi:Math.min(max,Math.max(span,mid+span/2))};}
 touchPoint(e){const r=this.svg.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
 start(e){this.svg.setPointerCapture?.(e.pointerId);this.touches.set(e.pointerId,this.touchPoint(e));this.drag=this.touchPoint(e);}
 move(e){if(!this.touches.has(e.pointerId))return;const pt=this.touchPoint(e),was=this.touches.get(e.pointerId);if(this.touches.size===1){const dom=this.xDomain();const diff=(pt.x-was.x)*(dom.hi-dom.lo)/.85;this.setState(s=>({panH:Math.max(-s.maxOrder/2,Math.min(s.maxOrder/2,s.panH-diff))}));}else{const other=[...this.touches.entries()].find(([id])=>id!==e.pointerId)?.[1];if(other){const prev=Math.abs(other.x-was.x),next=Math.abs(other.x-pt.x);if(prev>.015&&next>.015)this.setState(s=>({zoomX:Math.min(20,Math.max(1,s.zoomX*(next/prev)))}));}}this.touches.set(e.pointerId,pt);}
 end(e){this.touches.delete(e.pointerId);}
 render(){const s=this.state,harm=this.props.harmonics||[],f=this.props.frequency||50,fund=harm.find(x=>x.h===1)?.rms||0,all=this.props.totalRms||0;
  const den=s.norm==='fundamental'?fund:all;const value=x=>den>1e-12?100*x.rms/den:0;
  const entries=harm.filter(x=>x.h<=s.maxOrder&&(s.includeFundamental||x.h!==1)).map(x=>({...x,percent:value(x)}));
  const highest=Math.max(1,...entries.map(x=>x.percent)),yMax= Math.max(1,highest*1.19/s.zoomY),dom=this.xDomain();
  const W=920,H=350,L=70,R=893,T=24,B=296;
  const mx=h=>L+(h-dom.lo)/(dom.hi-dom.lo)*(R-L),my=y=>B-y/yMax*(B-T);
  const cx=dom.hi-dom.lo;const capW=Math.min(29,Math.max(8,(R-L)/cx*.44));
  const button=(text,fn,on)=>React.createElement('button',{type:'button',className:'scope-btn'+(on?' scope-active':''),onClick:fn},text);
  const renderDome=x=>{const X=mx(x.h),height=Math.min(B-T,Math.max(0,B-my(x.percent)));if(X<-60||X>W+50||x.percent<.035)return null;const y=B-height;const wide=capW;const path=`M ${X-wide} ${B} C ${X-wide} ${B-height*.57} ${X-wide*.66} ${y} ${X} ${y} C ${X+wide*.66} ${y} ${X+wide} ${B-height*.57} ${X+wide} ${B} Z`;
   return React.createElement('g',{key:x.h,onClick:()=>this.setState({selected:x.h}),style:{cursor:'pointer'}},React.createElement('path',{d:path,fill:x.h===1?'#5cc9ef':'#eeb773',fillOpacity:x.h===s.selected?.94:.72,stroke:x.h===s.selected?'#f7edbd':'#ffcf81',strokeWidth:x.h===s.selected?2.2:1}),x.percent>.2&&height>26?React.createElement('text',{x:X,y:Math.max(13,y-7),textAnchor:'middle',fontSize:11,fill:'#e9f7fb',fontWeight:750},x.percent.toFixed(x.percent<2?1:0)+'%'):null,React.createElement('title',null,`h=${x.h} · ${(f*x.h).toFixed(1)} Hz · ${x.rms.toFixed(5)} A RMS · ${x.percent.toFixed(2)}%`));};
  const ticks=[];const step=cx<=7?1:cx<=16?2:cx<=32?5:10;for(let h=Math.ceil(dom.lo/step)*step;h<=dom.hi+.00001;h+=step)ticks.push(h);
  const selected=harm.find(x=>x.h===s.selected)||harm[0];
  return React.createElement('div',{className:'harmonic-scope'},
    React.createElement('div',{className:'harmonic-head'},React.createElement('strong',null,'FFT · ΔΙΑΚΡΙΤΟ ΦΑΣΜΑ iₛ,ₐ'),React.createElement('span',null,'RMS Fourier bins · ακέραιες αρμονικές')),
    React.createElement('div',{className:'harmonic-tools'},
     React.createElement('label',null,'Άξονας X',React.createElement('select',{value:s.xUnit,onChange:e=>this.setState({xUnit:e.target.value})},React.createElement('option',{value:'order'},'Τάξη h'),React.createElement('option',{value:'freq'},'Συχνότητα Hz'))),
     React.createElement('label',null,'Άξονας Y',React.createElement('select',{value:s.norm,onChange:e=>this.setState({norm:e.target.value})},React.createElement('option',{value:'fundamental'},'% του I₁'),React.createElement('option',{value:'total'},'% του I RMS'))),
     React.createElement('label',null,'Μέγιστη αρμονική',React.createElement('select',{value:s.maxOrder,onChange:e=>this.setState({maxOrder:+e.target.value,zoomX:1,panH:0})},...[15,25,49].map(n=>React.createElement('option',{key:n,value:n},n)))),
     React.createElement('label',{className:'harmonic-check'},React.createElement('input',{type:'checkbox',checked:s.includeFundamental,onChange:e=>this.setState({includeFundamental:e.target.checked,zoomY:1})}),' Εμφάνιση 1ης'),
     React.createElement('div',{className:'harmonic-zoom'},button('X+',()=>this.setState(q=>({zoomX:Math.min(20,q.zoomX*1.6)}))),button('X−',()=>this.setState(q=>({zoomX:Math.max(1,q.zoomX/1.6)}))),button('Y+',()=>this.setState(q=>({zoomY:Math.min(80,q.zoomY*1.7)}))),button('Y−',()=>this.setState(q=>({zoomY:Math.max(1,q.zoomY/1.7)}))),button('⌖',()=>this.setState({zoomX:1,zoomY:1,panH:0})))),
    React.createElement('svg',{ref:n=>this.svg=n,className:'harmonic-screen',viewBox:`0 0 ${W} ${H}`,style:{touchAction:'none'},role:'img','aria-label':'Διακριτή αρμονική ανάλυση ρεύματος σε ποσοστά'},
      React.createElement('rect',{width:W,height:H,rx:8,fill:'#081b2c'}),
      ...Array.from({length:6},(_,i)=>{const v=yMax*i/5,y=my(v);return React.createElement('g',{key:'y'+i},React.createElement('line',{x1:L,x2:R,y1:y,y2:y,stroke:'#25475c',strokeDasharray:'3 5'}),React.createElement('text',{x:L-10,y:y+4,textAnchor:'end',fontSize:12,fill:'#b8d4df'},v.toFixed(v<10?1:0)+'%'));}),
      ...ticks.map(h=>React.createElement('g',{key:'x'+h},React.createElement('line',{x1:mx(h),x2:mx(h),y1:T,y2:B,stroke:'#1b3b4d',strokeDasharray:'3 6'}),React.createElement('text',{x:mx(h),y:B+24,fontSize:12,fill:'#b8d4df',textAnchor:'middle'},s.xUnit==='order'?String(h):String(Math.round(h*f))))),
      ...entries.filter(x=>x.h>=dom.lo-.5&&x.h<=dom.hi+.5).map(renderDome),
      React.createElement('text',{x:R-4,y:H-12,fontSize:13,fill:'#9ed7dc',textAnchor:'end'},s.xUnit==='order'?'Αρμονική τάξη h':'Συχνότητα fₕ [Hz]'),
      React.createElement('text',{x:L,y:16,fontSize:12,fill:'#9ed7dc'},s.norm==='fundamental'?'100% = I₁,RMS':'100% = I_RMS')),
    React.createElement('div',{className:'harmonic-info'},React.createElement('span',null,`Επιλογή h=${selected?.h||1}: ${((selected?.h||1)*f).toFixed(1)} Hz · ${((selected?.rms)||0).toFixed(4)} A RMS · ${den?(((selected?.rms)||0)/den*100).toFixed(2):'0.00'}%`),React.createElement('span',null,`THD = ${Number(this.props.thd||0).toFixed(2)}% · Drag / pinch / X,Y zoom`)),
    React.createElement('p',{className:'rect-subnote'},'Οι καμπυλωτές κορυφές είναι γραφικά σύμβολα διακριτών συνιστωσών, όχι συνεχές φάσμα. Το ύψος τους είναι το πραγματικό RMS της αντίστοιχης αρμονικής σε %. Για να δεις τις μικρές αρμονικές, απόκρυψε την 1η ή χρησιμοποίησε Y+.'));
 }
}


export {ScopeChart,HarmonicSpectrum};
