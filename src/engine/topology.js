/* Pure, deterministic electrical graph engine. No rendering or React dependencies.
   Wires and CLOSED internal contacts form zero-ohm conductive nets. Motor windings
   are finite-impedance elements, therefore they must NEVER be unioned as wires.
   WARNING: instructional steady-state phasor model, not fault-current or motor transients. */
const PHASES=['L1','L2','L3'];
const STARTS=['U1','V1','W1'];
const ENDS=['U2','V2','W2'];
const fmt=(x,n=1)=>Number.isFinite(x)?x.toLocaleString('el-GR',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
const C=['K1M','K2M','K3M','F3'];
const phasePin=(i)=>`L${i+1}`;
const pin=(c,side,i)=>`${c}.${side}${i+1}`;
const connect=(a,b,role='power')=>({id:`w-${a.replace(/\W/g,'_')}-${b.replace(/\W/g,'_')}`,a,b,role});
function defaultWires(thermal='line'){
  const e=[];
  for(let i=0;i<3;i++){
    e.push(connect(phasePin(i),pin('K1M','a',i)));
    e.push(connect(pin('K1M','b',i),pin('F3','a',i)));
    e.push(connect(pin('F3','b',i),`M.${STARTS[i]}`));
    e.push(connect(thermal==='line'?pin('F3','b',i):pin('K1M','b',i),pin('K2M','a',i)));
    const endsForDelta=['W2','U2','V2'];
    e.push(connect(pin('K2M','b',i),`M.${endsForDelta[i]}`));
    e.push(connect(`M.${ENDS[i]}`,pin('K3M','a',i)));
  }
  return e;
}
function allTerminals(){
  const out=[...PHASES];
  C.forEach(c=>['a','b'].forEach(s=>[0,1,2].forEach(i=>out.push(pin(c,s,i)))));
  [...STARTS,...ENDS].forEach(p=>out.push(`M.${p}`));
  return out;
}
function cleanWire(w){return w&&typeof w.a==='string'&&typeof w.b==='string'&&w.a!==w.b&&allTerminals().includes(w.a)&&allTerminals().includes(w.b)}
class DSU {
  constructor(names){this.parent=new Map(names.map(n=>[n,n]));}
  root(n){if(!this.parent.has(n))return null;const p=this.parent.get(n);if(p!==n)this.parent.set(n,this.root(p));return this.parent.get(n);}
  union(a,b){a=this.root(a);b=this.root(b);if(a&&b&&a!==b)this.parent.set(b,a);}
  groups(){const m=new Map();for(const t of this.parent.keys()){const root=this.root(t);if(!m.has(root))m.set(root,[]);m.get(root).push(t);}return [...m.values()];}
}
const complex=(re=0,im=0)=>({re,im});
const add=(a,b)=>complex(a.re+b.re,a.im+b.im);
const sub=(a,b)=>complex(a.re-b.re,a.im-b.im);
const div=(a,b)=>complex((a.re*b.re+a.im*b.im)/(b.re*b.re+b.im*b.im),(a.im*b.re-a.re*b.im)/(b.re*b.re+b.im*b.im));
const mag=(v)=>Math.hypot(v.re,v.im);
const phasor=(m,d)=>complex(m*Math.cos(d*Math.PI/180),m*Math.sin(d*Math.PI/180));
function solveFloatingWindingNets(groups,root,vl){
  const fixed=new Map();const phaseV=[phasor(vl/Math.sqrt(3),0),phasor(vl/Math.sqrt(3),-120),phasor(vl/Math.sqrt(3),120)];
  PHASES.forEach((p,i)=>fixed.set(root(p),phaseV[i]));
  const allW=STARTS.map((st,i)=>[root(`M.${st}`),root(`M.${ENDS[i]}`)]);
  const connected=new Set(allW.flat());
  const floating=[...connected].filter(n=>!fixed.has(n));
  const values=new Map(fixed);
  // Simple nodal relaxation is exact for identical winding impedances at convergence,
  // provided each connected component has a source reference.
  const adjacent=new Map(floating.map(x=>[x,[]]));
  allW.forEach(([a,b])=>{if(adjacent.has(a))adjacent.get(a).push(b);if(adjacent.has(b))adjacent.get(b).push(a)});
  // Floating islands not connected to any phase reference are inactive: 0 V.
  const reachable=new Set(fixed.keys());let grow=true;
  while(grow){grow=false;for(const [a,b] of allW){if(reachable.has(a)&&!reachable.has(b)){reachable.add(b);grow=true;}if(reachable.has(b)&&!reachable.has(a)){reachable.add(a);grow=true;}}}
  floating.forEach(x=>values.set(x,complex()));
  for(let k=0;k<1600;k++){
    let max=0;
    for(const n of floating){if(!reachable.has(n))continue;
      const neighbours=adjacent.get(n);if(!neighbours.length)continue;
      const average=neighbours.reduce((acc,x)=>add(acc,values.get(x)||complex()),complex());
      const next=complex(average.re/neighbours.length,average.im/neighbours.length);
      max=Math.max(max,mag(sub(next,values.get(n)))); values.set(n,next);
    }
    if(max<1e-9)break;
  }
  return {values,reachable,allW};
}
function analyzeTopology(wires,{mode='star',thermal='line',vl=400,z=20,pf=0.8,impedance:givenImpedance=null,trip=false,supplyOn=true}={}){
  const dsu=new DSU(allTerminals());
  for(const w of wires){if(cleanWire(w))dsu.union(w.a,w.b);}
  // Closed contacts of the main and selected changeover contactor.
  const closed=[...(supplyOn?['K1M']:[]),...(trip?[]:['F3']),...(mode==='star'?['K3M']:mode==='delta'?['K2M']:[])];
  C.forEach(c=>{if(closed.includes(c))for(let i=0;i<3;i++)dsu.union(pin(c,'a',i),pin(c,'b',i));});
  // The three output terminals of the star contactor are factory-bussed.
  dsu.union('K3M.b1','K3M.b2');dsu.union('K3M.b2','K3M.b3');
  const root=t=>dsu.root(t);
  const same=(a,b)=>root(a)===root(b);
  const groups=dsu.groups().map((members,index)=>({id:`N${index+1}`,members,phases:PHASES.filter(p=>members.includes(p))}));
  const netOf=t=>groups.find(g=>g.members.includes(t));
  const faults=[];const warnings=[];
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(same(PHASES[i],PHASES[j]))faults.push(`Βραχυκύκλωμα ${PHASES[i]}–${PHASES[j]}: οι φάσεις έχουν κοινό αγώγιμο κόμβο.`);
  STARTS.forEach((s,i)=>{if(same(`M.${s}`,`M.${ENDS[i]}`))faults.push(`Το τύλιγμα ${s}–${ENDS[i]} παρακάμπτεται από αγωγό (0 V στα άκρα).`)});
  if(mode==='star'){
    for(let i=0;i<3;i++){
      if(!same(PHASES[i],`M.${STARTS[i]}`))warnings.push(`${PHASES[i]} → ${STARTS[i]}: λείπει ή άλλαξε η αναμενόμενη διαδρομή.`);
    }
    if(!same('M.U2','M.V2')||!same('M.V2','M.W2'))warnings.push('Τα U2, V2, W2 δεν ανήκουν στον ίδιο κοινό κόμβο αστέρα.');
    if(ENDS.some(p=>PHASES.some(l=>same(`M.${p}`,l))))warnings.push('Ο κόμβος αστέρα αγγίζει άμεσα μία φάση.');
  } else if(mode==='delta'){
    for(const p of PHASES){const g=netOf(p);const nStart=STARTS.filter(x=>g.members.includes('M.'+x)).length;
      const nEnd=ENDS.filter(x=>g.members.includes('M.'+x)).length;
      if(nStart!==1||nEnd!==1)warnings.push(`Κόμβος ${p}: απαιτείται 1 αρχή + 1 τέλος τυλίγματος, βρέθηκαν ${nStart}+${nEnd}.`);
    }
    for(let i=0;i<3;i++)if(same(`M.${STARTS[i]}`,`M.${ENDS[i]}`))faults.push(`Απευθείας γέφυρα στο τύλιγμα ${STARTS[i]}.`);
  }
  const voltageNets=solveFloatingWindingNets(groups,root,vl);
  const impedance=givenImpedance?complex(givenImpedance.r,givenImpedance.i):complex(Math.max(.01,z)*pf,Math.max(.01,z)*Math.sqrt(1-pf*pf));
  const branch=STARTS.map((s,i)=>{
    const a=`M.${s}`,b=`M.${ENDS[i]}`,ra=root(a),rb=root(b);
    const va=voltageNets.values.get(ra)||complex(),vb=voltageNets.values.get(rb)||complex();
    const diff=sub(va,vb),current=div(diff,impedance);
    return {name:s[0],start:a,end:b,voltage:mag(diff),voltageComplex:diff,current:mag(current),currentComplex:current,energized:voltageNets.reachable.has(ra)&&voltageNets.reachable.has(rb)};
  });
  const lines=PHASES.map(p=>{
    let sum=complex(); const pr=root(p);
    branch.forEach((b,i)=>{if(root(b.start)===pr)sum=add(sum,b.currentComplex);if(root(b.end)===pr)sum=sub(sum,b.currentComplex)});
    return {name:p,current:mag(sum),currentComplex:sum};
  });
  const ratedDelta = vl/mag(impedance)*Math.sqrt(3);
  const healthy=faults.length===0&&warnings.length===0;
  return {mode,thermal,groups,netOf,root,same,branch,lines,ratedDelta,healthy,faults:[...new Set(faults)],warnings:[...new Set(warnings)],
    diagram:STARTS.map((s,i)=>({start:s,end:ENDS[i],startNet:netOf(`M.${s}`),endNet:netOf(`M.${ENDS[i]}`),...branch[i]})),
    windingCurrent:branch.reduce((a,b)=>a+b.current,0)/3, lineCurrent:lines.reduce((a,b)=>a+b.current,0)/3,
    windingVoltage:branch.reduce((a,b)=>a+b.voltage,0)/3,
    thermalSet:thermal==='line'?ratedDelta:ratedDelta/Math.sqrt(3),
  };
}
function auditBoth(wires,params){const star=analyzeTopology(wires,{...params,mode:'star'}),delta=analyzeTopology(wires,{...params,mode:'delta'});return {star,delta,ready:star.healthy&&delta.healthy};}
const sampleBadWires=()=>{
 const w=defaultWires();const target=w.find(x=>x.a==='K2M.b1');return w.map(e=>e===target?{...e,b:'M.U2'}:e);
};
function replaceWireEndpoint(wires,id,endpoint,newPin){return wires.map(w=>w.id!==id?w:{...w,[endpoint]:newPin});}
function makeWire(wires,a,b){
 if(a===b||!allTerminals().includes(a)||!allTerminals().includes(b)||wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a)))return wires;
 return [...wires,{id:'w-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),a,b,role:'user'}];
}


export {PHASES,STARTS,ENDS,fmt,defaultWires,allTerminals,auditBoth,analyzeTopology,replaceWireEndpoint,makeWire,sampleBadWires};
