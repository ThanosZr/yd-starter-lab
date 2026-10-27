/* Units-aware elementary oscilloscope math and windowed measurements. No eval(). */
const SCOPE_CHANNELS=[
 {id:'vd',label:'v_d · τάση DC',unit:'V'}, {id:'id',label:'i_d · ρεύμα DC',unit:'A'},
 {id:'va',label:'v_a · τάση L1',unit:'V'}, {id:'ia',label:'i_a · ρεύμα L1',unit:'A'},
 {id:'vb',label:'v_b · τάση L2',unit:'V',three:true}, {id:'ib',label:'i_b · ρεύμα L2',unit:'A',three:true},
 {id:'vc',label:'v_c · τάση L3',unit:'V',three:true}, {id:'ic',label:'i_c · ρεύμα L3',unit:'A',three:true},
 {id:'pl',label:'p_L · ισχύς πηνίου',unit:'W'}, {id:'pdc',label:'p_d · στιγμιαία DC ισχύς',unit:'W'}, {id:'psrc',label:'p_in · ολική ισχύς εισόδου',unit:'W'},
 {id:'pr',label:'p_R · θερμότητα αντίστασης',unit:'W'}
];
function scopeChannel(sample,id,R=50){switch(id){
 case 'vd':return sample.vd;case 'id':return sample.id;
 case 'va':return sample.voltages[0];case 'ia':return sample.ac[0];
 case 'vb':return sample.voltages[1]??NaN;case 'ib':return sample.ac[1]??NaN;
 case 'vc':return sample.voltages[2]??NaN;case 'ic':return sample.ac[2]??NaN;
 case 'pl':return sample.vd*sample.id-R*sample.id*sample.id;case 'pdc':return sample.vd*sample.id;case 'psrc':return sample.sourcePower;case 'pr':return R*sample.id*sample.id;
 default:return NaN;}}
function scopeMathUnit(idA,idB,op){const a=SCOPE_CHANNELS.find(c=>c.id===idA),b=SCOPE_CHANNELS.find(c=>c.id===idB);if(!a||!b)return {unit:'',valid:false,reason:'Μη έγκυρο κανάλι'};
 if(op==='mul'){const units=[a.unit,b.unit].sort().join('*');return{unit:units==='A*V'?'W':units==='A*A'?'A²':units==='V*V'?'V²':a.unit+'·'+b.unit,valid:true};}
 if(op==='div'){return{unit:a.unit===b.unit?'':a.unit==='V'&&b.unit==='A'?'Ω':a.unit+'/'+b.unit,valid:true};}
 if(a.unit!==b.unit)return{unit:a.unit,valid:false,reason:'Άθροισμα ή διαφορά με διαφορετικές μονάδες δεν έχει φυσικό νόημα.'};
 return{unit:a.unit,valid:true};}
function scopeMath(samples,parameters,{a='vd',b='id',op='mul',from=0,to=1}={}){
 const units=scopeMathUnit(a,b,op),lo=Math.min(from,to),hi=Math.max(from,to);
 const first=samples[0]?.t??0,last=samples[samples.length-1]?.t??1,windowStart=first+(last-first)*lo,windowEnd=first+(last-first)*hi;
 const points=[];const target=[];const fn=(x,y)=>op==='mul'?x*y:op==='add'?x+y:op==='sub'?x-y:Math.abs(y)<1e-10?NaN:x/y;
 for(const s of samples){if(s.t<windowStart-1e-10||s.t>windowEnd+1e-10)continue;const x=scopeChannel(s,a,parameters.R),y=scopeChannel(s,b,parameters.R),z=fn(x,y);if(!Number.isFinite(z))continue;points.push([s.t,z]);target.push(z);}
 const n=target.length,sum=target.reduce((a,b)=>a+b,0),mean=n?sum/n:NaN,rms=n?Math.sqrt(target.reduce((s,v)=>s+v*v,0)/n):NaN;
 const integral=points.length>1?points.reduce((sum,[t,v],i)=>i?sum+(points[i-1][1]+v)/2*(t-points[i-1][0]):sum,0):0;
 return{points,mean,rms,integral,min:n?target.reduce((a,b)=>Math.min(a,b),Infinity):NaN,max:n?target.reduce((a,b)=>Math.max(a,b),-Infinity):NaN,unit:units.unit,valid:units.valid,reason:units.reason||'',windowStart,windowEnd};
}
export {SCOPE_CHANNELS,scopeChannel,scopeMathUnit,scopeMath};
