import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeChannel,scopeMathUnit,scopeMath} from '../src/engine/scope-math.js';
import {rectSim,rectifierDefaults} from '../src/engine/rectifier.js';
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Math/Measure checks physical units and rejects V+A',()=>{
 assert.equal(scopeMathUnit('vd','id','mul').unit,'W');assert.equal(scopeMathUnit('vd','id','div').unit,'Ω');assert.equal(scopeMathUnit('vd','id','add').valid,false);assert.equal(scopeMathUnit('vd','va','sub').valid,true);
});
test('Math mean/RMS/integral and selected time window agree with a constant-power signal',()=>{
 const samples=Array.from({length:101},(_,i)=>({t:i*.001,vd:4,id:2,voltages:[4],ac:[2],sourcePower:8}));
 const a=scopeMath(samples,{R:2},{a:'vd',b:'id',op:'mul'}),b=scopeMath(samples,{R:2},{a:'vd',b:'id',op:'mul',from:.25,to:.75});
 close(a.mean,8);close(a.rms,8);close(a.integral,.8);close(b.integral,.4);assert.equal(a.unit,'W');
});
test('Math source power is total three-phase power; mean(v*i) differs from RMS(v*i)',()=>{
 const r=rectSim(rectifierDefaults('three')),total=scopeMath(r.steady,r.params,{a:'psrc',b:'pr',op:'sub'});
 close(total.mean,r.metrics.P-r.metrics.Pload);assert.ok(Math.abs(total.mean)<1e-9);
 const single=rectSim(rectifierDefaults('single')),p=scopeMath(single.steady,single.params,{a:'va',b:'ia',op:'mul'});close(p.mean,single.metrics.P);assert.ok(p.rms>p.mean);
});
test('Math excludes divide-by-zero values and missing phase channels',()=>{
 const sample={t:0,vd:4,id:0,voltages:[4],ac:[0],sourcePower:0};
 assert.equal(scopeMath([sample],{R:50},{a:'vd',b:'id',op:'div'}).points.length,0);assert.ok(Number.isNaN(scopeChannel(sample,'vb')));
});
test('Math inductive power matches the actual periodic input-minus-resistor residual',()=>{
 for(const phase of ['single','three']){
  const r=rectSim({...rectifierDefaults(phase),L:.6}),a=scopeMath(r.steady,r.params,{a:'psrc',b:'pr',op:'sub'});
  close(a.mean,r.metrics.powerResidual);assert.ok(Math.abs(a.mean)<.01);
 }
});
