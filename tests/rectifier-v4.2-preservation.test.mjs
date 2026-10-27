import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {rectSim,rectifierDefaults} from '../src/engine/rectifier.js';
const base=new URL('../',import.meta.url),hashes=JSON.parse(fs.readFileSync(new URL('tests/fixtures/v4.2-rectifier-sha256.json',base),'utf8'));
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
// These hashes come directly from the original v4.2 standalone, not from v4.3.
// Only module wiring and the new CSV version suffix are allowed to differ.
for(const [file,expected] of Object.entries(hashes))test('original v4.2 content preserved: '+file,()=>{
 const body=fs.readFileSync(new URL(file,base),'utf8').replace(/^import .*$/gm,'').replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm,'').replace('ece-lab-v4.3-math-trace.csv','ece-lab-v4.2-math-trace.csv').trim();
 assert.equal(crypto.createHash('sha256').update(body).digest('hex'),expected);
});
test('periodic RMS/PF/THD are independent of whether the startup trace has settled',()=>{
 for(const phase of ['single','three']){
  const params={...rectifierDefaults(phase),R:1,L:5,cycles:2},a=rectSim(params),b=rectSim({...params,cycles:80});
  assert.equal(a.steady.length,1200);assert.ok(a.metrics.periodicError>1);assert.equal(a.metrics.settled,false);
  for(const key of ['P','Pload','S','S1','Q1','D','PF','lambda','thd','iaRms','idRms','idAvg','i1Rms','distortionFactor'])close(a.metrics[key],b.metrics[key]);
 }
});
test('v4.2 power decomposition and distortion-factor relationship are retained',()=>{
 for(const phase of ['single','three'])for(const opt of [{L:0},{L:.6},{idealSmoothing:true}]){
  const m=rectSim({...rectifierDefaults(phase),...opt}).metrics;
  close(m.lambda,m.P/m.S);close(m.lambda,m.distortionFactor*m.cosPhi1);
  close(m.S1*m.S1,m.P*m.P+m.Q1*m.Q1);close(m.S*m.S,m.P*m.P+m.Q1*m.Q1+m.D*m.D);
  assert.ok(Math.abs(m.powerResidualPercent)<.1,'periodic power balance residual too large');
 }
});
test('per-diode measurements preserve conduction partition and total RMS balance',()=>{
 for(const phase of ['single','three']){
  const r=rectSim({...rectifierDefaults(phase),L:.6}),diodes=Object.values(r.diodeMetrics),m=r.metrics;
  assert.equal(diodes.length,phase==='single'?4:6);
  close(diodes.reduce((v,x)=>v+x.avg,0),2*m.idAvg);close(diodes.reduce((v,x)=>v+x.rms*x.rms,0),2*m.idRms*m.idRms);
  diodes.forEach(d=>close(d.avg,m.idAvg/(phase==='single'?2:3)));close(m.diodePIV,Math.SQRT2*r.params.vrms);
 }
});
