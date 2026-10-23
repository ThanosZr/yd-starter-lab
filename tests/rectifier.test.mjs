import test from 'node:test';import assert from 'node:assert/strict';
import{rectSim,rectifierDefaults,rectMeanVoltage}from '../src/engine/rectifier.js';
const approx=(a,b,err=.01)=>assert.ok(Math.abs(a-b)<err,`${a} should approximate ${b}`);
test('single phase ideal average voltage and R load',()=>{const x=rectSim(rectifierDefaults('single'));approx(x.metrics.vdAvg,2*Math.SQRT2/Math.PI*50,.01);approx(x.metrics.idAvg,x.metrics.vdAvg/50,.001);approx(x.metrics.PF,1,.001);approx(x.metrics.thd,0,.001)});
test('three phase bridge has six distinct pairs and analytical average',()=>{const x=rectSim(rectifierDefaults('three'));approx(x.metrics.vdAvg,3*Math.SQRT2/Math.PI*50,.02);assert.equal(new Set(x.samples.map(s=>s.pair.join('+'))).size,6);approx(x.metrics.idAvg,x.metrics.vdAvg/50,.001)});
test('R-L smooths output current, preserving voltage bridge',()=>{const a=rectSim(rectifierDefaults('single')),b=rectSim({...rectifierDefaults('single'),L:.6});assert.ok(b.metrics.ripple<a.metrics.ripple);approx(a.metrics.vdAvg,b.metrics.vdAvg,.002);assert.ok(b.metrics.PF<1)});
test('L→infinity idealized steady-state current is constant',()=>{const x=rectSim({...rectifierDefaults('three'),idealSmoothing:true});approx(x.metrics.ripple,0,.00001);approx(x.metrics.idAvg,rectMeanVoltage(x.params)/x.params.R,.00001)});
test('displacement reactive power for RL single phase is inductive-sign',()=>{const x=rectSim({...rectifierDefaults('single'),L:.6});assert.ok(x.metrics.Q1>=0)});
