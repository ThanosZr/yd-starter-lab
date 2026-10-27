import test from 'node:test';
import assert from 'node:assert/strict';
import {motorPreset,motorPoint,ratedLoadTorque,loadTorque,loadReferenceTorque,scenarioSnapshot,advanceMotor,predictMotor,historyAt} from '../src/engine/motor-dynamics.js';
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const config=(extra={})=>({plate:'230/400',vl:230,params:motorPreset('230/400'),startMode:'star-delta',loadPct:10,loadUnit:'torque',loadTorqueNm:10,deltaLoadEnabled:true,deltaLoadTorqueNm:60,loadShape:'constant',delay:8,deadTime:.32,strategy:'independent',threshold:85,timeHorizon:15,starRemoved:false,...extra});

test('load is applied exactly at Delta closure; speed is continuous and dead time retains the initial load',()=>{
 const cfg=config(),h=predictMotor(cfg,10,.137);
 const index=h.findIndex(x=>x.run==='DELTA'),before=h[index-1],after=h[index];
 close(after.time,8.32);close(after.time,before.time);close(after.speed,before.speed);
 assert.ok(h.slice(0,index).every(x=>x.load===10&&x.loadStage==='initial'));
 assert.ok(h.slice(index).every(x=>x.load===60&&x.loadStage==='delta'));
 for(const t of [8,8.01,8.31999]){const x=historyAt(h,t,cfg);close(x.load,10);close(x.current,0);close(x.torque,0);}
 const edge=historyAt(h,8.32,cfg);close(edge.load,60);assert.ok(edge.current>0);
 // Mechanical load does not set an arbitrary electromagnetic torque or current.
 const electrical=motorPoint(after.slip,'delta',cfg.vl,cfg.params);close(after.torque,electrical.torque);close(after.current,electrical.currentLine);
});

test('10 to 60 Nm scenario reaches a higher shaft torque, electromagnetic torque and both currents on both nameplates',()=>{
 for(const [plate,vl] of [['230/400',230],['400/690',400]]){
  const cfg=config({plate,vl,params:motorPreset(plate)}),h=predictMotor(cfg,15);
  const y=h.filter(x=>x.run==='STAR').at(-1),d=h.at(-1);
  assert.ok(y.speed>.9&&d.speed>.9);assert.equal(y.load,10);assert.equal(d.load,60);
  assert.ok(d.torque>y.torque);assert.ok(d.current>y.current);assert.ok(d.currentPhase>y.currentPhase);
  close(y.torque,y.load+y.friction,1e-6);close(d.torque,d.load+d.friction,1e-6);
  close(y.current,y.currentPhase);close(d.current,Math.sqrt(3)*d.currentPhase);
 }
});

test('load step follows timed and speed-triggered live playback identically to prediction',()=>{
 for(const strategy of ['independent','speed']){
  const cfg=config({strategy}),expected=predictMotor(cfg,12).at(-1);
  for(const step of [.095,.19,1.9]){
   let state={time:0,speed:0,run:'STAR',switchAt:0};
   while(state.time<12-1e-9)state=advanceMotor(state,Math.min(step,12-state.time),cfg).state;
   close(state.speed,expected.speed,1e-6);assert.equal(state.loadStage,'delta');
   close(scenarioSnapshot(state,cfg).load,60);
  }
 }
});

test('one-load, percent, permanent-Y and direct-Delta modes preserve their intended mechanical loading',()=>{
 const single=config({deltaLoadEnabled:false});assert.ok(predictMotor(single,10).every(x=>x.load===10));
 const legacy=config({loadUnit:'percent',loadPct:23,loadTorqueNm:500,deltaLoadTorqueNm:1000});
 const expected=.23*ratedLoadTorque(230,legacy.params);assert.ok(predictMotor(legacy,10).every(x=>Math.abs(x.load-expected)<1e-8));
 const y=predictMotor(config({startMode:'star'}),10);assert.ok(y.every(x=>x.run==='STAR'&&x.load===10));
 const d=predictMotor(config({startMode:'delta'}),1);assert.ok(d.every(x=>x.run==='DELTA'&&x.load===60));
 const stopped=scenarioSnapshot({...d.at(-1),run:'OFF'},config());assert.equal(stopped.load,60);assert.equal(stopped.current,0);
});

test('fan torque entries are referenced to rated speed; dead-time mechanics respond to the actual load',()=>{
 const cfg=config({loadShape:'fan'}),omegaN=(1-cfg.params.ratedSlip)*4*Math.PI*cfg.params.f/cfg.params.poles;
 for(const stage of ['initial','delta']){
  const reference=loadReferenceTorque(cfg,stage);
  close(loadTorque(omegaN,0,230,cfg.params,'fan',reference),reference);
  close(loadTorque(omegaN/2,0,230,cfg.params,'fan',reference),reference/4);
  close(loadTorque(0,0,230,cfg.params,'fan',reference),0);
 }
 const start={time:8,speed:.8,run:'DEAD',switchAt:8,loadStage:'initial'};
 const light=advanceMotor(start,.1,config({loadTorqueNm:0})),heavy=advanceMotor(start,.1,config({loadTorqueNm:50}));
 assert.ok(heavy.state.speed<light.state.speed);assert.equal(heavy.live.current,0);
});

test('absolute torque is not clamped to 100 percent; overload can stall instead of forcing acceleration',()=>{
 const cfg=config({loadTorqueNm:1000,deltaLoadTorqueNm:1000});
 assert.ok(predictMotor(cfg,10).every(x=>x.speed===0&&x.load===1000));
 const low=config({loadTorqueNm:0,deltaLoadEnabled:false});assert.ok(predictMotor(low,10).at(-1).speed>.95);
});
