/* Educational ideal diode bridges: no source impedance, diode drops or commutation overlap.
   Visible start-up is an RL transient. Published harmonic and power measurements use
   the true PERIODIC solution of the same model, never a potentially unsettled transient.
   Midpoint integration has fixed coherent grid and numerical residual checks. */
const rcClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rectifierDefaults(phase='single'){return{phase,vrms:50,f:50,R:50,L:0,idealSmoothing:false,dt:.0001,cycles:10};}
function rectAt(t,p){const w=2*Math.PI*p.f*t;let voltages,positive,negative,vd,pair;
 if(p.phase==='single'){const v=Math.SQRT2*p.vrms*Math.sin(w);voltages=[v];vd=Math.abs(v);positive=v>=0?0:1;negative=v>=0?1:0;pair=v>=0?['D1','D4']:['D3','D2'];}
 else {const amp=Math.SQRT2*p.vrms/Math.sqrt(3);voltages=[0,-2*Math.PI/3,2*Math.PI/3].map(phi=>amp*Math.sin(w+phi));positive=voltages.indexOf(Math.max(...voltages));negative=voltages.indexOf(Math.min(...voltages));vd=voltages[positive]-voltages[negative];pair=[['D1','D3','D5'][positive],['D4','D6','D2'][negative]];}
 return{t,voltages,vd,pair,positive,negative};}
const rectMeanVoltage=p=>p.phase==='single'?2*Math.SQRT2*p.vrms/Math.PI:3*Math.SQRT2*p.vrms/Math.PI;
function withCurrents(a,current,p){const ac=p.phase==='single'?[Math.sign(a.voltages[0])*current]:[0,1,2].map(k=>k===a.positive?current:k===a.negative?-current:0);return{...a,id:current,ac,power:a.vd*current,sourcePower:a.voltages.reduce((sum,v,k)=>sum+v*ac[k],0)};}
function rectSim(input){const p={...rectifierDefaults(),...input};p.R=rcClamp(Number(p.R)||50,.1,10000);p.vrms=rcClamp(Number(p.vrms)||50,1,2000);p.f=rcClamp(Number(p.f)||50,1,500);p.L=Math.max(0,Number(p.L)||0);p.cycles=rcClamp(Math.round(Number(p.cycles)||10),2,80);
 const freqN=Math.max(80,Math.min(2000,Math.round(1/(p.f*rcClamp(Number(p.dt)||.0001,.00001,.004))))),dt=1/(p.f*freqN),N=p.cycles*freqN;
 const avgV=rectMeanVoltage(p),smoothId=avgV/p.R;const isRL=p.L>0&&!p.idealSmoothing;
 const evolve=(current,v,step)=>{if(!isRL)return p.idealSmoothing?smoothId:v/p.R;const q=-Math.expm1(-p.R*step/p.L);return current*(1-q)+(v/p.R)*q;};
 // Waveforms from a motor/rectifier switched on with zero inductor current.
 let current=0;const samples=[];
 for(let i=0;i<N;i++){const t=(i+.5)*dt,a=rectAt(t,p);const instant=isRL?evolve(current,a.vd,dt/2):p.idealSmoothing?smoothId:a.vd/p.R;samples.push(withCurrents(a,instant,p));if(isRL)current=evolve(current,a.vd,dt);}
 // Compute steady state independently, using the affine one-period map
 // i(T)=exp(-RT/L)i(0)+b; periodic i(0)=b/[1-exp(-RT/L)].
 const spectralN=1200,periodDt=1/(p.f*spectralN);let periodicInitial=0;
 if(isRL){let b=0;for(let k=0;k<spectralN;k++)b=evolve(b,rectAt((k+.5)*periodDt,p).vd,periodDt);const denominator=-Math.expm1(-p.R/(p.f*p.L));periodicInitial=denominator>1e-14?b/denominator:avgV/p.R;}
 let state=periodicInitial;const steady=[];
 for(let k=0;k<spectralN;k++){const a=rectAt((k+.5)*periodDt,p),currentAtCenter=isRL?evolve(state,a.vd,periodDt/2):p.idealSmoothing?smoothId:a.vd/p.R;steady.push(withCurrents(a,currentAtCenter,p));if(isRL)state=evolve(state,a.vd,periodDt);}
 const avg=fn=>steady.reduce((sum,x)=>sum+fn(x),0)/steady.length;
 const rms=fn=>Math.sqrt(avg(x=>fn(x)**2));
 const vdAvg=avg(x=>x.vd),idAvg=avg(x=>x.id),idRms=rms(x=>x.id),iaRms=rms(x=>x.ac[0]);
 const fundamentalCoefficients=[];const rmsHarm=[];
 for(let h=1;h<=49;h++){let a=0,b=0;for(let k=0;k<steady.length;k++){const angle=2*Math.PI*h*(k+.5)/spectralN;a+=steady[k].ac[0]*Math.cos(angle);b+=steady[k].ac[0]*Math.sin(angle);}a*=2/spectralN;b*=2/spectralN;const obj={h,rms:Math.hypot(a,b)/Math.SQRT2,cos:a,sin:b};rmsHarm.push(obj);}
 const fundamental=rmsHarm[0]?.rms||0,displacement=Math.atan2(-(rmsHarm[0]?.cos||0),rmsHarm[0]?.sin||0);
 const Pin=avg(x=>x.sourcePower),Pload=avg(x=>p.R*x.id*x.id),S=(p.phase==='single'?p.vrms:Math.sqrt(3)*p.vrms)*iaRms,Q1=(p.phase==='single'?p.vrms:Math.sqrt(3)*p.vrms)*fundamental*Math.sin(displacement);
 const THD=fundamental>1e-10?Math.sqrt(Math.max(0,iaRms*iaRms-fundamental*fundamental))/fundamental*100:0;
 const D=Math.sqrt(Math.max(0,S*S-Pin*Pin-Q1*Q1));
 const periodicError=isRL?Math.abs(current-periodicInitial)/Math.max(Math.abs(periodicInitial),1e-9)*100:0;
 const bridgeDiodes=p.phase==='single'?['D1','D2','D3','D4']:['D1','D2','D3','D4','D5','D6'];
 const diodeMetrics=Object.fromEntries(bridgeDiodes.map(name=>[name,{avg:avg(x=>x.pair.includes(name)?x.id:0),rms:rms(x=>x.pair.includes(name)?x.id:0)}]));
 return{params:p,samples,use:steady,steady,dt,samplesCycle:freqN,harmonics:rmsHarm,diodeMetrics,metrics:{vdAvg,idAvg,idRms,iaRms,i1Rms:fundamental,thd:THD,PF:S>1e-10?Pin/S:0,lambda:S>1e-10?Pin/S:0,distortionFactor:iaRms>1e-10?fundamental/iaRms:0,cosPhi1:Math.cos(displacement),phi1:displacement*180/Math.PI,P:Pin,Q1,S,S1:Math.sqrt(Pin*Pin+Q1*Q1),D,Pload,powerResidual:Pin-Pload,powerResidualPercent:Pload>1e-8?100*(Pin-Pload)/Pload:0,periodicError,settled:periodicError<1,vRms:p.vrms,ripple:rms(x=>x.id-idAvg)/Math.max(idAvg,1e-9)*100,diodePIV:Math.SQRT2*p.vrms,diodeAvg:p.phase==='single'?idAvg/2:idAvg/3}};
}
export {rectifierDefaults,rectAt,rectMeanVoltage,rectSim};
