import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTOR_DEFAULTS,RATED_SLIP,motorPreset,rescaleMotor,motorImpedance,motorPoint,ratedLoadTorque,loadTorque,integrateMotor,motorScenario,advanceMotor,predictMotor,instantaneousCurrents,historyAt,currentScopeSeries} from '../src/engine/motor-dynamics.js';
import {defaultWires,analyzeTopology} from '../src/engine/topology.js';
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const config=(plate='230/400',vl=230,extra={})=>({plate,vl,params:motorPreset(plate),startMode:'star-delta',loadPct:10,loadShape:'constant',delay:4,deadTime:.32,strategy:'mounted',threshold:85,timeHorizon:10,starRemoved:false,...extra});

test('120 valid circuit cases: graph and motor agree for both plates, three voltages, slip and F3',()=>{
 for(const plate of ['230/400','400/690'])for(const vl of [230,400,690])for(const slip of [0,.001,.045,.2,1])for(const mode of ['star','delta'])for(const thermal of ['line','winding']){
  const params=motorPreset(plate),p=motorPoint(slip,mode,vl,params),g=analyzeTopology(defaultWires(thermal),{mode,thermal,vl,impedance:motorImpedance(slip,params)});
  assert.ok(g.healthy);close(g.lineCurrent,p.currentLine);close(g.windingCurrent,p.currentPhase);close(g.windingVoltage,p.voltagePhase);
  g.branch.forEach(b=>close(b.current,p.currentPhase));g.lines.forEach(l=>close(l.current,p.currentLine));
 }
});
test('same-slip Y/Delta ratios separately validate line current, winding current and torque',()=>{
 for(const plate of ['230/400','400/690'])for(const v of [230,400,690])for(const slip of [.001,.045,.2,1]){
  const p=motorPreset(plate),y=motorPoint(slip,'star',v,p),d=motorPoint(slip,'delta',v,p);
  close(y.currentLine,y.currentPhase);close(d.currentLine,Math.sqrt(3)*d.currentPhase);close(y.currentLine/d.currentLine,1/3);close(y.currentPhase/d.currentPhase,1/Math.sqrt(3));close(y.torque/d.torque,1/3);
 }
});
test('230/400 at 230V: 132.79V in Y, 230V in Delta, same rated-preset torque as 400/690 at 400V',()=>{
 for(const slip of [1,.3,.045]){
  const p=motorPreset('230/400'),y=motorPoint(slip,'star',230,p),d=motorPoint(slip,'delta',230,p);
  close(y.voltagePhase,230/Math.sqrt(3));close(d.voltagePhase,230);close(y.torque,motorPoint(slip,'star',400).torque);close(d.torque,motorPoint(slip,'delta',400).torque);
 }
 const a=predictMotor(config(),10).at(-1),b=predictMotor(config('400/690',400),10).at(-1);close(a.speed,b.speed);assert.ok(a.speed>.95);
});
test('same physical motor: current scales with V, torque with V squared',()=>{
 for(const mode of ['star','delta'])for(const slip of [1,.045]){const a=motorPoint(slip,mode,230),b=motorPoint(slip,mode,400);close(a.currentLine/b.currentLine,230/400);close(a.torque/b.torque,(230/400)**2);}
});
test('nameplate guard checks final connection; nominal permanent Y at 400V/690V remains valid',()=>{
 for(const [plate,vl,ok] of [['230/400',230,true],['230/400',400,false],['400/690',400,true],['400/690',690,false]]){assert.equal(motorScenario({plate,vl}).allowed,ok);assert.equal(predictMotor(config(plate,vl),1).length>0,ok);}
 for(const [plate,vl] of [['230/400',400],['400/690',690]]){const h=predictMotor(config(plate,vl,{startMode:'star'}),10);assert.ok(h.length);assert.ok(h.every(x=>x.run==='STAR'));assert.ok(h.at(-1).speed>.95);}
});
test('s=0: no torque, finite magnetizing current and open rotor branch',()=>{
 const p=motorPoint(0,'delta',400);assert.equal(p.torque,0);assert.ok(p.currentPhase>0&&Number.isFinite(p.currentPhase));close(p.impedance.r,MOTOR_DEFAULTS.R1);close(p.impedance.i,MOTOR_DEFAULTS.X1+MOTOR_DEFAULTS.Xm);
});
test('independent air-gap power / rotor copper calculation verifies Thevenin torque',()=>{
 const mul=(a,b)=>({r:a.r*b.r-a.i*b.i,i:a.r*b.i+a.i*b.r}),sub=(a,b)=>({r:a.r-b.r,i:a.i-b.i}),div=(a,b)=>({r:(a.r*b.r+a.i*b.i)/(b.r*b.r+b.i*b.i),i:(a.i*b.r-a.r*b.i)/(b.r*b.r+b.i*b.i)});
 for(const v of [230,400])for(const slip of [.005,.045,.2,1]){
  const p=motorPoint(slip,'delta',v),i1=div({r:v,i:0},p.impedance),e=sub({r:v,i:0},mul(i1,{r:MOTOR_DEFAULTS.R1,i:MOTOR_DEFAULTS.X1})),i2=div(e,{r:MOTOR_DEFAULTS.R2/slip,i:MOTOR_DEFAULTS.X2});
  const pin=3*v*i1.r,cu1=3*(i1.r**2+i1.i**2)*MOTOR_DEFAULTS.R1,cu2=3*(i2.r**2+i2.i**2)*MOTOR_DEFAULTS.R2;
  close(pin-cu1,p.torque*p.omegaSync);close(cu2,slip*p.torque*p.omegaSync);close(pin-cu1-cu2,p.torque*p.omegaSync*(1-slip));
 }
});
test('rated shaft load excludes friction once, stays fixed when actual voltage changes',()=>{
 const p=MOTOR_DEFAULTS,r=motorPoint(RATED_SLIP,'delta',400,p),omega=(1-RATED_SLIP)*r.omegaSync;close(ratedLoadTorque(400,p)+p.viscous*omega,r.torque);
 const a=integrateMotor(1-RATED_SLIP,.5,'DELTA',100,400,p,'constant',400),b=integrateMotor(1-RATED_SLIP,0,'DELTA',100,230,p,'constant',400);close(a.speed,1-RATED_SLIP);close(a.load,b.load);
 assert.ok(integrateMotor(1-RATED_SLIP,.5,'DELTA',100,230,p,'constant',400).speed<a.speed);close(loadTorque(0,100,400,p,'fan'),0);
});
test('heavy load: stalls in Y, accelerates after timed Delta; speed criterion never forces changeover',()=>{
 const a=predictMotor(config('230/400',230,{loadPct:100}),10);assert.ok(a.filter(x=>x.run==='STAR').every(x=>x.speed===0));assert.ok(a.at(-1).speed>.9);
 const b=predictMotor(config('230/400',230,{loadPct:100,strategy:'speed'}),10);assert.ok(b.every(x=>x.run==='STAR'));
});
test('timed edges are exact; no current or torque interpolation across dead time',()=>{
 const cfg=config(),h=predictMotor(cfg,6,.137),edges=h.filter((x,i)=>i&&x.run!==h[i-1].run);close(edges[0].time,4);close(edges[1].time,4.32);
 for(const t of [4,4.00001,4.1,4.31999]){const x=historyAt(h,t,cfg);assert.equal(x.run,'DEAD');assert.equal(x.current,0);assert.equal(x.currentPhase,0);assert.equal(x.torque,0);}
 assert.ok(historyAt(h,4.32,cfg).current>0);assert.ok(h[0].current>0);
});
test('live and prediction use the same integration and events at different playback rates',()=>{
 const cfg=config(),expected=predictMotor(cfg,8).at(-1);
 for(const step of [.095,.19,1.9]){let s={time:0,speed:0,run:'STAR',switchAt:0};while(s.time<8-1e-9)s=advanceMotor(s,Math.min(step,8-s.time),cfg).state;close(s.speed,expected.speed,1e-6);}
});
test('missing star leads: zero I/Te until Delta closes at locked-rotor current',()=>{
 const cfg=config('230/400',230,{starRemoved:true}),h=predictMotor(cfg,6);
 for(const x of h.filter(x=>x.run==='STAR')){assert.equal(x.speed,0);assert.equal(x.current,0);assert.equal(x.currentPhase,0);assert.equal(x.torque,0);}
 close(h.find(x=>x.run==='DELTA').current,motorPoint(1,'delta',230,cfg.params).currentLine);assert.equal(historyAt(h,2,cfg).current,0);
});
test('instantaneous currents: Y equality, Delta KCL, sqrt3 RMS and 30 degree displacement',()=>{
 for(const run of ['STAR','DELTA']){let line=0,phase=0,cross=0;
  for(let i=0;i<1000;i++){const w=instantaneousCurrents(i/50000,.2,run,230,motorPreset('230/400'));close(w.line.reduce((a,b)=>a+b,0),0);close(w.phase.reduce((a,b)=>a+b,0),0);if(run==='STAR')w.line.forEach((x,k)=>close(x,w.phase[k]));else{close(w.line[0],w.phase[0]-w.phase[2]);close(w.line[1],w.phase[1]-w.phase[0]);}line+=w.line[0]**2;phase+=w.phase[0]**2;cross+=w.line[0]*w.phase[0];}
  close(Math.sqrt(line/phase),run==='STAR'?1:Math.sqrt(3));close(cross/Math.sqrt(line*phase),run==='STAR'?1:Math.cos(Math.PI/6));
 }
});
test('overview and zoom show both families and preserve zero-current dead time',()=>{
 const cfg=config(),h=predictMotor(cfg,6),overview=currentScopeSeries(h,{x0:0,x1:6},cfg);assert.ok(overview.some(x=>x.name==='IL RMS'));assert.ok(overview.some(x=>x.name==='Iφ RMS'));
 const dead=currentScopeSeries(h,{x0:4.05,x1:4.10},cfg);assert.equal(dead.length,6);assert.ok(dead.every(x=>x.points.every(p=>p[1]===0)));
 const y=currentScopeSeries(h,{x0:.05,x1:.10},cfg);for(let k=0;k<3;k++)y[k].points.forEach((p,i)=>close(p[1],y[k+3].points[i][1]));
});
test('impedance calibration consistently scales currents and torque; plate scaling is reversible',()=>{
 const p=motorPreset('230/400'),z=motorImpedance(1,p),ratio=3,scaled={...p,...Object.fromEntries(['R1','X1','R2','X2','Xm'].map(k=>[k,p[k]*ratio]))},actual=motorImpedance(1,scaled);
 close(Math.hypot(actual.r,actual.i),Math.hypot(z.r,z.i)*ratio);close(motorPoint(1,'star',230,scaled).currentLine,motorPoint(1,'star',230,p).currentLine/ratio);close(motorPoint(1,'star',230,scaled).torque,motorPoint(1,'star',230,p).torque/ratio);
 const back=rescaleMotor(rescaleMotor(p,'230/400','400/690'),'400/690','230/400');Object.keys(p).forEach(k=>close(back[k],p[k]));
});
