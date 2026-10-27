/* Balanced induction-motor per-winding equivalent coupled to rotor motion.
 * Currents are quasi-steady RMS phasors, not an electromagnetic transient
 * solution. Switching flux, DC offset and saturation are not modelled. */
const MOTOR_DEFAULTS=Object.freeze({R1:1.2,X1:2.3,R2:0.85,X2:2.2,Xm:90,J:0.65,poles:4,f:50,viscous:0.25,ratedSlip:.045});
const RATED_SLIP=.045;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const c=(r,i=0)=>({r,i});
const ca=(a,b)=>c(a.r+b.r,a.i+b.i);
const cm=(a,b)=>c(a.r*b.r-a.i*b.i,a.r*b.i+a.i*b.r);
const cd=(a,b)=>c((a.r*b.r+a.i*b.i)/(b.r*b.r+b.i*b.i),(a.i*b.r-a.r*b.i)/(b.r*b.r+b.i*b.i));
const cabs=a=>Math.hypot(a.r,a.i);
function motorRating(plate='400/690'){
 if(!['230/400','400/690'].includes(plate))throw Error('Unknown motor nameplate');
 const [delta,star]=plate.split('/').map(Number);return {delta,star,winding:delta};
}
// Teaching preset: same power/torque, rewound for the other voltage. The
// nameplate alone does NOT determine an actual motor's R/X or torque.
function rescaleMotor(params,fromPlate,toPlate){
 const ratio=(motorRating(toPlate).delta/motorRating(fromPlate).delta)**2;
 return {...params,...Object.fromEntries(['R1','X1','R2','X2','Xm'].map(k=>[k,params[k]*ratio]))};
}
function motorPreset(plate='400/690'){return rescaleMotor(MOTOR_DEFAULTS,'400/690',plate);}
function motorImpedance(sl,params=MOTOR_DEFAULTS){
 const s=clamp(sl,0,1),z1=c(params.R1,params.X1),zm=c(0,params.Xm);
 const zr=s>0?c(params.R2/s,params.X2):null;
 // Exact zero-slip limit: rotor branch open, magnetizing current remains.
 return ca(z1,zr?cd(cm(zm,zr),ca(zm,zr)):zm);
}
function motorPoint(sl,connection='delta',volts=400,params=MOTOR_DEFAULTS){
 const s=clamp(sl,0,1),vphase=connection==='star'?volts/Math.sqrt(3):volts;
 const zin=motorImpedance(s,params),z1=c(params.R1,params.X1),zm=c(0,params.Xm);
 const zth=cd(cm(z1,zm),ca(z1,zm)),vth=vphase*cabs(cd(zm,ca(z1,zm)));
 const iphase=vphase/cabs(zin),iline=connection==='delta'?iphase*Math.sqrt(3):iphase;
 const omegaSync=4*Math.PI*params.f/params.poles,rotorR=s>0?params.R2/s:0;
 const torque=s>0?3*vth*vth*rotorR/(omegaSync*((zth.r+rotorR)**2+(zth.i+params.X2)**2)):0;
 const phi=Math.atan2(zin.i,zin.r);
 return {torque,currentLine:iline,currentPhase:iphase,voltagePhase:vphase,phi,
  // Standard wiring U=L1-L2,V=L2-L3,W=L3-L1: winding voltage leads by 30 deg.
  phiLine:phi,phiPhase:phi-(connection==='delta'?Math.PI/6:0),impedance:zin,zth,
  slip:s,rpm:(1-s)*120*params.f/params.poles,omegaSync};
}
// Rated SHAFT load is independent of ACTUAL supply voltage. Friction is
// removed here and added exactly once in the mechanical equation.
function ratedLoadTorque(ratedDelta=400,params=MOTOR_DEFAULTS){
 const sn=params.ratedSlip??RATED_SLIP,p=motorPoint(sn,'delta',ratedDelta,params);
 return Math.max(0,p.torque-params.viscous*(1-sn)*p.omegaSync);
}
// Explicit shaft torque is independent of the electrical connection. The
// optional second level represents an externally applied load when Delta closes.
function loadReferenceTorque(config,stage='initial'){
 if(config.loadUnit!=='torque')return ratedLoadTorque(motorRating(config.plate).delta,config.params)*clamp(config.loadPct??0,0,100)/100;
 const value=stage==='delta'&&config.deltaLoadEnabled?config.deltaLoadTorqueNm:config.loadTorqueNm;
 return Number.isFinite(value)?Math.max(0,value):0;
}
function loadTorque(omega,loadPct,ratedDelta=400,params=MOTOR_DEFAULTS,shape='constant',shaftTorqueNm=null){
 const rated=Number.isFinite(shaftTorqueNm)?Math.max(0,shaftTorqueNm):ratedLoadTorque(ratedDelta,params)*clamp(loadPct,0,100)/100;
 const ratedOmega=(1-(params.ratedSlip??RATED_SLIP))*4*Math.PI*params.f/params.poles;
 return rated*(shape==='fan'?(Math.max(0,omega)/ratedOmega)**2:1);
}
function motorSnapshot(speed,run,loadPct,volts=400,params=MOTOR_DEFAULTS,shape='constant',ratedDelta=400,shaftTorqueNm=null){
 const v=clamp(speed,0,1),p=motorPoint(1-v,run==='STAR'?'star':'delta',volts,params);
 const on=run==='STAR'||run==='DELTA',shaftLoad=loadTorque(v*p.omegaSync,loadPct,ratedDelta,params,shape,shaftTorqueNm),friction=params.viscous*v*p.omegaSync;
 const loadReferenceNm=Number.isFinite(shaftTorqueNm)?Math.max(0,shaftTorqueNm):ratedLoadTorque(ratedDelta,params)*clamp(loadPct,0,100)/100;
 return {speed:v,slip:1-v,rpm:p.rpm,torque:on?p.torque:0,load:shaftLoad,friction,loadReferenceNm,
  current:on?p.currentLine:0,currentPhase:on?p.currentPhase:0,voltagePhase:on?p.voltagePhase:0};
}
function integrateMotor(speed,dt,run,loadPct,volts=400,params=MOTOR_DEFAULTS,shape='constant',ratedDelta=400,shaftTorqueNm=null){
 const omegaS=4*Math.PI*params.f/params.poles;let omega=clamp(speed,0,1)*omegaS;
 const on=run==='STAR'||run==='DELTA',mode=run==='STAR'?'star':'delta';
 const acceleration=w=>{
  const u=clamp(w,0,omegaS),te=on?motorPoint(1-u/omegaS,mode,volts,params).torque:0;
  const a=(te-loadTorque(u,loadPct,ratedDelta,params,shape,shaftTorqueNm)-params.viscous*u)/params.J;
  return u===0&&a<0?0:a;
 };
 const n=Math.max(1,Math.ceil(Math.max(0,dt)/.008)),h=Math.max(0,dt)/n;
 // RK4 keeps predictions consistent with playback at different frame rates.
 for(let k=0;k<n;k++){
  const a=acceleration(omega),b=acceleration(omega+h*a/2),d=acceleration(omega+h*b/2),e=acceleration(omega+h*d);
  omega=clamp(omega+h*(a+2*b+2*d+e)/6,0,omegaS);
 }
 return motorSnapshot(omega/omegaS,run,loadPct,volts,params,shape,ratedDelta,shaftTorqueNm);
}
function motorScenario({plate='400/690',vl=400,startMode='star-delta',params=null}={}){
 const rating=motorRating(plate),finalConnection=startMode==='star'?'star':'delta';
 const finalWinding=finalConnection==='star'?vl/Math.sqrt(3):vl,nominalLine=rating[finalConnection],ratio=vl/nominalLine;
 // 2% numerical allowance for rounded markings, not an operating tolerance.
 const voltageAllowed=ratio<=1.02;
 const ratingValid=!params||ratedLoadTorque(rating.delta,params)>0;
 const allowed=voltageAllowed&&ratingValid;
 let message=allowed?`Πινακίδα Δ${rating.delta}/Υ${rating.star} V · VLL=${vl} V · τελική σύνδεση ${finalConnection==='star'?'Υ':'Δ'} · Vφ=${finalWinding.toFixed(1)} V.`:
  `START αποκλείστηκε: τελική ${finalConnection==='star'?'Υ':'Δ'} στα ${vl} V υπερβαίνει την πινακίδα ${nominalLine} V. Επιλέξτε ${finalConnection==='delta'?'μόνιμο Υ ή μικρότερη πολική τάση':'μικρότερη πολική τάση'}.`;
 if(allowed&&ratio<.95)message+=' Υποτάση: μειωμένη διαθέσιμη ροπή· το φορτίο αναφοράς δεν μειώνεται αυτόματα.';
 if(!ratingValid)message='START αποκλείστηκε: στο επιλεγμένο sN η Te δεν καλύπτει τις τριβές BωN. Δεν ορίζεται θετικό 100% φορτίο άξονα. Ελέγξτε R/X, sN και B στις παραμέτρους.';
 return {allowed,message,rating,finalConnection,finalWinding,ratio};
}
function startingRun(config){return config.startMode==='delta'?'DELTA':'STAR';}
function electricalRun(run,config){return run==='STAR'&&config.starRemoved?'DEAD':run;}
function scenarioSnapshot(state,config){
 const loadStage=state.loadStage??(state.run==='DELTA'?'delta':'initial');
 const m=motorSnapshot(state.speed,electricalRun(state.run,config),config.loadPct,config.vl,config.params,config.loadShape,motorRating(config.plate).delta,loadReferenceTorque(config,loadStage));
 return {...m,time:state.time,run:state.run,loadStage};
}
// Shared live/prediction event engine. Split at exact timed boundaries; retain
// both sides of each current/torque jump at the same time coordinate.
function advanceMotor(state,dt,config){
 let next={time:state.time,speed:state.speed,run:state.run,switchAt:state.switchAt,loadStage:state.loadStage??(state.run==='DELTA'?'delta':'initial')},remaining=Math.max(0,dt);const points=[];
 const emit=()=>points.push(scenarioSnapshot(next,config));
 const transition=()=>{
  if(next.run==='STAR'&&config.startMode==='star-delta'&&
   (config.strategy==='speed'?next.speed*100>=config.threshold:next.time>=config.delay-1e-10)){
   emit();next.run='DEAD';next.switchAt=next.time;emit();return true;
  }
  if(next.run==='DEAD'&&next.time>=next.switchAt+config.deadTime-1e-10){emit();next.run='DELTA';next.loadStage='delta';emit();return true;}
  return false;
 };
 while(remaining>1e-10){
  if(transition())continue;
  let h=Math.min(.008,remaining);
  if(next.run==='STAR'&&config.startMode==='star-delta'&&config.strategy!=='speed')h=Math.min(h,Math.max(0,config.delay-next.time));
  if(next.run==='DEAD')h=Math.min(h,Math.max(0,next.switchAt+config.deadTime-next.time));
  if(h<=1e-10){if(!transition())break;continue;}
  const m=integrateMotor(next.speed,h,electricalRun(next.run,config),config.loadPct,config.vl,config.params,config.loadShape,motorRating(config.plate).delta,loadReferenceTorque(config,next.loadStage));
  next.speed=m.speed;next.time+=h;remaining-=h;
 }
 transition();emit();return {state:next,points,live:scenarioSnapshot(next,config)};
}
function predictMotor(config,duration,step=.08){
 if(!motorScenario(config).allowed)return [];
 if(config.starRemoved&&config.startMode==='star-delta'&&config.strategy==='speed')return [];
 let state={time:0,speed:0,run:startingRun(config),switchAt:0,loadStage:config.startMode==='delta'?'delta':'initial'};const points=[scenarioSnapshot(state,config)];
 while(state.time<duration-1e-9){const part=advanceMotor(state,Math.min(step,duration-state.time),config);state=part.state;points.push(...part.points);}
 return points;
}
function instantaneousCurrents(t,speed,run,volts=400,params=MOTOR_DEFAULTS,layout=null){
 const on=run==='STAR'||run==='DELTA',p=motorPoint(1-speed,run==='STAR'?'star':'delta',volts,params);
 if(layout){
  const phase=layout.voltageFactors.map(v=>on?Math.SQRT2*volts*Math.hypot(v.re,v.im)/cabs(p.impedance)*Math.sin(2*Math.PI*params.f*t+Math.atan2(v.im,v.re)-p.phi):0);
  const line=layout.incidence.map(row=>row.reduce((sum,factor,i)=>sum+factor*phase[i],0));
  return {line,phase};
 }
 const phase=[0,-2*Math.PI/3,2*Math.PI/3].map(a=>on?Math.SQRT2*p.currentPhase*Math.sin(2*Math.PI*params.f*t-p.phiPhase+a):0);
 // KCL produces the actual 30 deg line/winding displacement in delta.
 const line=run==='DELTA'?[phase[0]-phase[2],phase[1]-phase[0],phase[2]-phase[1]]:[...phase];
 return {line,phase};
}
function calculateTrace(start,end,step,speed,run,volts,params=MOTOR_DEFAULTS){
 return Array.from({length:Math.ceil((end-start)/step)+1},(_,i)=>{const t=start+i*step,w=instantaneousCurrents(t,speed,run,volts,params);return {t,phases:w.line,windingPhases:w.phase};});
}
// Never interpolate current across a switching edge or through open contacts.
function historyAt(history,t,config){
 if(!history.length||t<history[0].time||t>history[history.length-1].time+1e-9)return {speed:0,run:'OFF',current:0,currentPhase:0};
 let lo=0,hi=history.length;
 while(lo<hi){const mid=(lo+hi)>>1;if(history[mid].time<=t)lo=mid+1;else hi=mid;}
 const a=history[Math.max(0,lo-1)],b=history[Math.min(lo,history.length-1)],q=b.time>a.time?clamp((t-a.time)/(b.time-a.time),0,1):0;
 const speed=a.speed+(b.speed-a.speed)*q,run=electricalRun(a.run,config),loadStage=a.loadStage??(a.run==='DELTA'?'delta':'initial');
 const reference=Number.isFinite(a.loadReferenceNm)?a.loadReferenceNm:loadReferenceTorque(config,loadStage);
 return {...motorSnapshot(speed,run,config.loadPct,config.vl,config.params,config.loadShape,motorRating(config.plate).delta,reference),run,loadStage};
}
function currentScopeSeries(history,view,config,kind='both'){
 const a=Math.max(0,view.x0),b=Math.min(config.timeHorizon,view.x1,history.at(-1)?.time??0);if(b<=a||!history.length)return [];
 const span=b-a,groups=kind==='both'?['line','phase']:[kind],colors={line:['#62c6e9','#81dba3','#c29dff'],phase:['#ffc278','#ff8caf','#e8e58e']};
 if(view.x1-view.x0>2.8){
  const n=Math.min(950,Math.max(220,Math.ceil(span*16))),times=new Set(Array.from({length:n+1},(_,i)=>a+span*i/n));
  history.forEach((x,i)=>{if(x.time>=a&&x.time<=b&&(i===0||x.run!==history[i-1].run)){times.add(Math.max(a,x.time-1e-7));times.add(x.time);}});
  const samples=[...times].sort((x,y)=>x-y).map(t=>[t,historyAt(history,t,config)]);
  return groups.flatMap(g=>{const key=g==='line'?'current':'currentPhase',name=g==='line'?'IL':'Iφ',color=colors[g][0];return [
   {name:name+' RMS',color,width:g==='line'?3:2,dash:g==='phase'?'7 5':null,points:samples.map(([t,x])=>[t,x[key]])},
   ...[1,-1].map(sign=>({name:`${name} ${sign>0?'+':'−'}peak`,color,opacity:.45,dash:g==='phase'?'7 5':null,points:samples.map(([t,x])=>[t,sign*Math.SQRT2*x[key]])}))];});
 }
 const n=Math.min(6500,Math.max(360,Math.ceil(span*config.params.f*32))),traces=groups.flatMap(g=>[0,1,2].map(i=>({name:g==='line'?`iL${i+1}`:`iφ${['U','V','W'][i]}`,color:colors[g][i],width:g==='line'?2.6:1.7,dash:g==='phase'?'7 5':null,points:[],group:g,index:i})));
 const times=Array.from({length:n+1},(_,i)=>a+span*i/n);
 history.forEach((x,i)=>{if(x.time>a&&x.time<b&&i&&x.run!==history[i-1].run)times.push(x.time-1e-8,x.time);});times.sort((x,y)=>x-y);
 for(const t of times){const x=historyAt(history,t,config),w=instantaneousCurrents(t,x.speed,x.run,config.vl,config.params,config.layouts?.[x.run]);traces.forEach(trace=>trace.points.push([t,w[trace.group][trace.index]]));}
 return traces;
}
export {MOTOR_DEFAULTS,RATED_SLIP,motorRating,motorPreset,rescaleMotor,motorImpedance,motorPoint,ratedLoadTorque,loadReferenceTorque,loadTorque,motorSnapshot,integrateMotor,motorScenario,startingRun,scenarioSnapshot,advanceMotor,predictMotor,instantaneousCurrents,calculateTrace,historyAt,currentScopeSeries};
