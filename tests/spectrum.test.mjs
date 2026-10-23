import test from 'node:test';
import assert from 'node:assert/strict';
import {rectSim,rectifierDefaults} from '../src/engine/rectifier.js';
const sim=(phase,opt)=>rectSim({...rectifierDefaults(phase),...opt});
const pct=(r,h)=>100*r.harmonics[h-1].rms/r.harmonics[0].rms;
test('1-phase resistor input has negligible harmonic distortion',()=>{
 const r=sim('single',{L:0});assert.ok(r.metrics.thd<.001);assert.ok(Math.abs(r.metrics.PF-1)<.002);
});
test('1-phase ideally smoothed bridge approximates square-wave Fourier sequence',()=>{
 const r=sim('single',{idealSmoothing:true});assert.ok(Math.abs(pct(r,3)-33.333)<.1);assert.ok(Math.abs(pct(r,5)-20)<.1);
 assert.ok(Math.abs(r.metrics.thd-48.34)<.15);
});
test('3-phase smoothed bridge has 6k±1 harmonics and no spurious triplen',()=>{
 const r=sim('three',{idealSmoothing:true});assert.ok(pct(r,3)<.001);assert.ok(Math.abs(pct(r,5)-20)<.1);
 assert.ok(Math.abs(r.metrics.thd-31.08)<.15);
});
test('3-phase purely resistive bridge has no artificial low-frequency third harmonic',()=>{
 const r=sim('three',{L:0});assert.ok(pct(r,3)<.001);
});
test('3-phase RL finite inductance remains harmonic-consistent',()=>{
 const r=sim('three',{L:.45,idealSmoothing:false});assert.ok(pct(r,3)<.005);assert.ok(r.metrics.thd>0&&r.metrics.thd<55);assert.ok(r.harmonics.every(x=>Number.isFinite(x.rms)));
});
