/* Ideal diode bridge simulator, lossless source, zero commutation overlap.
   RL current solved with exact piecewise-constant voltage exponential step.
   All harmonic and power figures are computed on the settled final cycles. */
function rcClamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rectifierDefaults(phase='single'){return{phase,vrms:50,f:50,R:50,L:0,idealSmoothing:false,dt:0.0001,cycles:10};}
function rectAt(t,p){const w=2*Math.PI*p.f*t;let voltages,positive,negative,vd,pair;
 if(p.phase==='single'){
  const ac=Math.SQRT2*p.vrms*Math.sin(w);voltages=[ac];vd=Math.abs(ac);positive=ac>=0?0:1;negative=ac>=0?1:0;pair=ac>=0?['D1','D4']:['D3','D2'];
 }else{
  const v=p.vrms*Math.SQRT2/Math.sqrt(3);voltages=[0,-2*Math.PI/3,2*Math.PI/3].map(phi=>v*Math.sin(w+phi));positive=voltages.indexOf(Math.max(...voltages));negative=voltages.indexOf(Math.min(...voltages));vd=voltages[positive]-voltages[negative];pair=[['D1','D3','D5'][positive],['D4','D6','D2'][negative]];
 }
 return{t,voltages,vd,pair,positive,negative};
}
function rectMeanVoltage(p){return p.phase==='single'?2*Math.SQRT2/Math.PI*p.vrms:3*Math.SQRT2/Math.PI*p.vrms;}
function rectSim(input){const p={...rectifierDefaults(),...input};p.R=rcClamp(Number(p.R)||50,.1,10000);p.vrms=rcClamp(Number(p.vrms)||50,1,2000);p.f=rcClamp(Number(p.f)||50,1,500);p.L=Math.max(0,Number(p.L)||0);p.cycles=rcClamp(Math.round(Number(p.cycles)||10),2,80);const samplesCycle=Math.max(80,Math.min(2000,Math.round(1/(p.f*rcClamp(Number(p.dt)||.0001,0.00001,.004)))));const dt=1/(p.f*samplesCycle),N=p.cycles*samplesCycle;const average=rectMeanVoltage(p),smoothId=average/p.R;let id=0;const samples=[];
 for(let i=0;i<N;i++){
  const t=(i+.5)*dt;const a=rectAt(t,p);const current=p.idealSmoothing?smoothId:p.L===0?a.vd/p.R:id;
  const inputCurr=p.phase==='single'?[Math.sign(a.voltages[0])*current]:[0,0,0].map((_,k)=>k===a.positive?current:k===a.negative?-current:0);
  samples.push({...a,id:current,ac:inputCurr,power:a.vd*current});
  if(p.L>0&&!p.idealSmoothing){const attenuation=Math.exp(-p.R*dt/p.L);id=id*attenuation+a.vd/p.R*(1-attenuation);}
 }
 const use=samples.slice(-4*samplesCycle);const avg=f=>use.reduce((sum,x)=>sum+f(x),0)/use.length;const rms=f=>Math.sqrt(avg(x=>f(x)**2));const vdAvg=avg(x=>x.vd),idAvg=avg(x=>x.id),idRms=rms(x=>x.id),vRms=p.vrms,iaRms=rms(x=>x.ac[0]);
 // Higher-accuracy Fourier integration: fixed coherent 1200 samples per cycle.
 // The user timestep controls the visible transient simulation; the harmonic
 // window is sampled independently, so switching instants never alias into
 // artificial low-order harmonics (e.g. spurious triplens in the 3φ bridge).
 const windowCycles=Math.min(4,p.cycles),spectralN=1200,spectralDt=1/(p.f*spectralN);
 const spectralStart=(p.cycles-windowCycles)/p.f;
 const startIndex=Math.max(0,(p.cycles-windowCycles)*samplesCycle);
 let spectralId=p.L>0&&!p.idealSmoothing?(samples[startIndex]?.id||0):0;
 const spectral=[];
 for(let k=0;k<windowCycles*spectralN;k++){
  const time=spectralStart+(k+.5)*spectralDt,a=rectAt(time,p);
  const current=p.idealSmoothing?smoothId:p.L===0?a.vd/p.R:spectralId;
  spectral.push(p.phase==='single'?Math.sign(a.voltages[0])*current:(a.positive===0?current:a.negative===0?-current:0));
  if(p.L>0&&!p.idealSmoothing){const attenuation=Math.exp(-p.R*spectralDt/p.L);spectralId=spectralId*attenuation+a.vd/p.R*(1-attenuation);}
 }
 const spectralRms=Math.sqrt(spectral.reduce((v,x)=>v+x*x,0)/spectral.length);
 const rmsHarm=[];for(let n=1;n<=49;n++){
   let ca=0,cb=0;
   for(let k=0;k<spectral.length;k++){
      const angle=2*Math.PI*n*((k+.5)%spectralN)/spectralN;
      ca+=spectral[k]*Math.cos(angle);cb+=spectral[k]*Math.sin(angle);
   }
   ca*=2/spectral.length;cb*=2/spectral.length;
   rmsHarm.push({h:n,rms:Math.hypot(ca,cb)/Math.SQRT2,cos:ca,sin:cb});
 }
 const fundamental=rmsHarm[0]?.rms||0;
 // source phase voltage is sqrt(2)*Vrms*sin(ωt); trig projections correspond sin coefficient.
 const displacement=Math.atan2(-(rmsHarm[0]?.cos||0),rmsHarm[0]?.sin||0);
 const pInput=p.phase==='single'?avg(x=>x.voltages[0]*x.ac[0]):avg(x=>x.voltages.reduce((sum,v,k)=>sum+v*x.ac[k],0));
 const S=p.phase==='single'?vRms*spectralRms:Math.sqrt(3)*vRms*spectralRms;
 const Q1=(p.phase==='single'?vRms:Math.sqrt(3)*vRms)*fundamental*Math.sin(displacement);
 const Pload=avg(x=>p.R*x.id*x.id);const D=Math.sqrt(Math.max(0,S*S-pInput*pInput-Q1*Q1));
 const thd=fundamental>1e-10?Math.sqrt(Math.max(0,spectralRms*spectralRms-fundamental*fundamental))/fundamental*100:0;
 return{params:p,samples,use,dt,samplesCycle,metrics:{vdAvg,idAvg,idRms,iaRms:spectralRms,i1Rms:fundamental,thd,PF:S>1e-10?pInput/S:0,cosPhi1:Math.cos(displacement),phi1:displacement*180/Math.PI,P:pInput,Q1,S,D,Pload,vRms,ripple:rms(x=>x.id-idAvg)/Math.max(idAvg,1e-9)*100},harmonics:rmsHarm};
}
export {rectifierDefaults,rectAt,rectSim,rectMeanVoltage};
