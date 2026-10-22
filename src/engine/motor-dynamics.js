/* Educational, per-phase steady-state induction-motor Thevenin approximation.
   Dynamic rotor motion is integrated from torque minus load; electric current
   waveform is an instantaneous sinusoidal visualization using a quasi-steady
   phasor/envelope, NOT a full electromagnetic-transient motor solution. */
const MOTOR_DEFAULTS=Object.freeze({R1:1.2,X1:2.3,R2:0.85,X2:2.2,Xm:90,J:0.65,poles:4,f:50,viscous:0.25});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const c=(r,i=0)=>({r,i});
const ca=(a,b)=>c(a.r+b.r,a.i+b.i);
const cm=(a,b)=>c(a.r*b.r-a.i*b.i,a.r*b.i+a.i*b.r);
const cd=(a,b)=>c((a.r*b.r+a.i*b.i)/(b.r*b.r+b.i*b.i),(a.i*b.r-a.r*b.i)/(b.r*b.r+b.i*b.i));
const cabs=a=>Math.hypot(a.r,a.i);
function motorPoint(sl,connection='delta',volts=400,params=MOTOR_DEFAULTS){
  const s=clamp(sl,0.0005,1);const r1=params.R1,x1=params.X1,r2=params.R2,x2=params.X2,xm=params.Xm;
  const z1=c(r1,x1),zm=c(0,xm),zr=c(r2/s,x2),vphase=connection==='star'?volts/Math.sqrt(3):volts;
  const zth=cd(cm(z1,zm),ca(z1,zm)),vth=vphase*cabs(cd(zm,ca(z1,zm)));
  const zpar=cd(cm(zm,zr),ca(zm,zr)),zin=ca(z1,zpar);
  const iphase=vphase/cabs(zin),iline=connection==='delta'?iphase*Math.sqrt(3):iphase;
  const omegaSync=4*Math.PI*params.f/params.poles; // mechanical synchronous rad/s
  const torque=3*vth*vth*(r2/s)/(omegaSync*((zth.r+r2/s)**2+(zth.i+x2)**2));
  const phaseAngle=Math.atan2(zin.i,zin.r);
  return {torque,currentLine:iline,currentPhase:iphase,phi:phaseAngle,slip:s,rpm:(1-s)*120*params.f/params.poles,omegaSync};
}
function ratedLoadTorque(volts=400,params=MOTOR_DEFAULTS){return motorPoint(.045,'delta',volts,params).torque;}
function loadTorque(omega,loadPct,volts=400,params=MOTOR_DEFAULTS,shape='constant'){
 const rated=ratedLoadTorque(volts,params)*clamp(loadPct,0,100)/100;
 const ratio=clamp(omega/(4*Math.PI*params.f/params.poles),0,1);
 return rated*(shape==='fan'?(0.05+0.95*ratio*ratio):1);
}
function integrateMotor(speed,dt,run,loadPct,volts=400,params=MOTOR_DEFAULTS,shape='constant'){
 const omegaS=4*Math.PI*params.f/params.poles;let omega=clamp(speed,0,.9995)*omegaS;
 if(!['STAR','DEAD','DELTA'].includes(run))return {speed:omega/omegaS,slip:1-omega/omegaS,torque:0,load:0,current:0};
 // integration substeps reduce numerical discretization artifacts
 const sub=Math.max(1,Math.ceil(dt/.008)),step=dt/sub;
 for(let k=0;k<sub;k++){
  const slip=clamp(1-omega/omegaS,.0005,1),mode=run==='STAR'?'star':'delta';
  const motorTorque=run==='DEAD'?0:motorPoint(slip,mode,volts,params).torque;
  const mechanical=loadTorque(omega,loadPct,volts,params,shape)+params.viscous*omega;
  omega=clamp(omega+(motorTorque-mechanical)/params.J*step,0,omegaS*.9995);
 }
 const newSpeed=omega/omegaS,p=motorPoint(1-newSpeed,run==='STAR'?'star':'delta',volts,params);
 return {speed:newSpeed,slip:1-newSpeed,torque:run==='DEAD'?0:p.torque,load:loadTorque(omega,loadPct,volts,params,shape)+params.viscous*omega,current:run==='DEAD'?0:p.currentLine,rpm:p.rpm};
}
function calculateTrace(start,end,step,speed,run,volts,params=MOTOR_DEFAULTS){
 const p=motorPoint(1-speed,run==='STAR'?'star':'delta',volts,params);
 const factor=run==='DEAD'||run==='OFF'||run==='TRIP'?0:1;
 return Array.from({length:Math.ceil((end-start)/step)+1},(_,i)=>{const t=start+i*step;
 return {t,phases:[0,-2*Math.PI/3,2*Math.PI/3].map(a=>Math.sqrt(2)*p.currentLine*Math.sin(2*Math.PI*params.f*t-p.phi+a)*factor)};
 });
}
export {MOTOR_DEFAULTS,motorPoint,ratedLoadTorque,loadTorque,integrateMotor,calculateTrace};
