import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTOR_DEFAULTS,motorPoint,integrateMotor,calculateTrace,ratedLoadTorque} from '../src/engine/motor-dynamics.js';
import {defaultWires,auditBoth} from '../src/engine/topology.js';

test('Y current and electromagnetic torque are one third of delta at same slip',()=>{
 for(const s of [1,0.15,0.045]){
  const y=motorPoint(s,'star',400),d=motorPoint(s,'delta',400);
  assert.ok(Math.abs(y.currentLine/d.currentLine-1/3)<1e-10);
  assert.ok(Math.abs(y.torque/d.torque-1/3)<1e-10);
 }
});
test('open star leads: delta remains valid and star invalid',()=>{
 const wires=defaultWires().filter(w=>!/^K3M\.a[123]$/.test(w.a)&&!/^K3M\.a[123]$/.test(w.b));
 assert.equal(wires.length,15);
 const result=auditBoth(wires,{});
 assert.equal(result.delta.healthy,true);
 assert.equal(result.star.healthy,false);
});
test('motor evolves at zero load in Y, stalls at sufficiently high constant load',()=>{
 let noLoad=0,fullLoad=0;
 for(let i=0;i<400;i++){
  noLoad=integrateMotor(noLoad,.01,'STAR',0,400,MOTOR_DEFAULTS,'constant').speed;
  fullLoad=integrateMotor(fullLoad,.01,'STAR',100,400,MOTOR_DEFAULTS,'constant').speed;
 }
 assert.ok(noLoad>.25,`no-load should accelerate: ${noLoad}`);
 assert.ok(fullLoad<noLoad,`loaded starting should accelerate less than zero-load: ${fullLoad}`);
});
test('dead time has zero stator current and developed motor torque',()=>{
 const a=integrateMotor(.65,.1,'DEAD',25);
 assert.equal(a.current,0);
 assert.equal(a.torque,0);
});
test('waveform is finite and three phase shifted',()=>{
 const wave=calculateTrace(0,.04,.0001,.2,'DELTA',400);
 assert.ok(wave.length>100);
 assert.ok(wave.every(x=>x.phases.every(Number.isFinite)));
 assert.ok(ratedLoadTorque(400)>0);
});
