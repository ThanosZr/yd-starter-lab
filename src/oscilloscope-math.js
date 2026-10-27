import {ScopeChart} from './oscilloscope.js';
import {SCOPE_CHANNELS,scopeMath} from './engine/scope-math.js';
/* Independent oscilloscope math processor: a selectable derived channel and its
   measurements. Works with the existing v4.1 ScopeChart, without replacing it. */
const smEl=(name,props,...children)=>React.createElement(name,props,...children.flat(Infinity));
// Visual downsampling only: all original samples are retained for measurements.
function scopeCompress(points,limit=2400){
 if(points.length<=limit)return points;
 const bucket=Math.ceil(points.length/Math.floor(limit/2)),out=[];
 for(let i=0;i<points.length;i+=bucket){const part=points.slice(i,i+bucket);let small=part[0],large=part[0];for(const q of part){if(q[1]<small[1])small=q;if(q[1]>large[1])large=q;}if(small[0]<large[0])out.push(small,large);else if(small!==large)out.push(large,small);else out.push(small);}
 return out;
}
class OscilloscopeMath extends React.Component{
 constructor(props){super(props);this.state={a:'vd',b:'id',op:'mul',source:'steady',from:0,to:100,showHelp:false};}
 exportMath(points,expr,unit){
  const csv='time_s,math_value,unit\n'+points.map(([t,v])=>`${t},${v},${unit}`).join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='ece-lab-v4.3-math-trace.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 render(){const {sim}=this.props,s=this.state,channels=SCOPE_CHANNELS.filter(c=>sim.params.phase==='three'||!c.three),source=s.source==='steady'?sim.steady:sim.samples;
 const data=scopeMath(source,sim.params,{a:s.a,b:s.b,op:s.op,from:s.from/100,to:s.to/100}),dUnit=data.unit||'1',label=(id)=>SCOPE_CHANNELS.find(c=>c.id===id)?.label||id;
 const opLabel={mul:'×',add:'+',sub:'−',div:'÷'}[s.op],expression=label(s.a)+' '+opLabel+' '+label(s.b),num=v=>Number.isFinite(v)?v.toLocaleString('el-GR',{maximumFractionDigits:5}):'—';
 const select=(key,arr)=>smEl('select',{value:s[key],onChange:e=>this.setState({[key]:e.target.value})},...arr.map(([value,label])=>smEl('option',{key:value,value},label)));
 const measurement=(title,value,unit)=>smEl('div',{className:'math-measure'},smEl('small',null,title),smEl('strong',null,num(value)),smEl('span',null,unit));
 const displayUnit=dUnit==='1'?'':dUnit;
 return smEl('section',{className:'panel math-processor'},
 smEl('div',{className:'subhead'},'MATH / MEASURE · ΠΡΑΞΕΙΣ ΜΕΤΑΞΥ ΚΑΝΑΛΙΩΝ'),
 smEl('p',{className:'rect-subnote'},'Υπολόγισε ένα νέο στιγμιαίο σήμα από δύο πραγματικά κανάλια. Ιδιαίτερα χρήσιμο: τάση × ρεύμα = στιγμιαία ισχύς. Οι μετρήσεις αφορούν το επιλεγμένο χρονικό παράθυρο.'),
 smEl('div',{className:'math-controls'},
 smEl('label',null,'Κανάλι A',select('a',channels.map(c=>[c.id,c.label]))),
 smEl('label',null,'Πράξη',select('op',[['mul','Πολλαπλασιασμός ×'],['add','Πρόσθεση +'],['sub','Αφαίρεση −'],['div','Διαίρεση ÷']])),
 smEl('label',null,'Κανάλι B',select('b',channels.map(c=>[c.id,c.label]))),
 smEl('label',null,'Δεδομένα',select('source',[['steady','Μόνιμη περιοδική κατάσταση'],['transient','Εκκίνηση (μεταβατικό)']])),
 smEl('button',{type:'button',className:'btn outline',onClick:()=>this.setState({a:'va',b:'ia',op:'mul',source:'steady',from:0,to:100})},'vₐ × iₐ'),
 smEl('button',{type:'button',className:'btn outline',onClick:()=>this.setState({a:'vd',b:'id',op:'mul',source:'steady',from:0,to:100})},'v_d × i_d'),
 smEl('button',{type:'button',className:'btn outline',onClick:()=>this.setState({a:'psrc',b:'pr',op:'sub',source:'steady',from:0,to:100})},'p_in − p_R (πηνίο)'),
 smEl('button',{type:'button',className:'btn outline',onClick:()=>this.exportMath(data.points,expression,displayUnit)},'⇩ Math CSV')),
 !data.valid?smEl('p',{className:'math-warning'},'⚠ ',data.reason):null,
 smEl('div',{className:'math-window'},smEl('label',null,'Αρχή παραθύρου '+s.from+'%',smEl('input',{type:'range',min:0,max:95,step:1,value:s.from,onChange:e=>this.setState({from:Math.min(+e.target.value,Math.max(0,this.state.to-1))})})),smEl('label',null,'Τέλος παραθύρου '+s.to+'%',smEl('input',{type:'range',min:5,max:100,step:1,value:s.to,onChange:e=>this.setState({to:Math.max(+e.target.value,Math.min(100,this.state.from+1))})}))),
 data.valid?smEl(ScopeChart,{key:'math-'+s.source+'-'+s.op+'-'+s.a+'-'+s.b,series:[{name:'Math: '+expression,color:'#f5c97a',points:scopeCompress(data.points)}],options:{title:'MATH TRACE · '+expression+' ['+displayUnit+']',xMin:data.windowStart,xMax:data.windowEnd,xLabel:'t [s]'}}):null,
 smEl('div',{className:'math-results'},measurement('Μέση τιμή ⟨y⟩',data.mean,displayUnit),measurement('Ενεργός τιμή (RMS)',data.rms,displayUnit),measurement('Ελάχιστο',data.min,displayUnit),measurement('Μέγιστο',data.max,displayUnit),measurement('∫y(t)dt',data.integral,displayUnit+'·s')),
 smEl('p',{className:'rect-subnote'},'Η μέση τιμή του γινομένου v·i είναι ενεργός ισχύς P [W], ενώ το RMS του v·i δεν ισούται γενικά με την ενεργό ισχύ. Το ∫p(t)dt δίνει ενέργεια [J]. Για τριφασική συνολική ισχύ επίλεξε το κανάλι p_in.'),
 smEl('button',{type:'button',className:'btn outline',onClick:()=>this.setState(st=>({showHelp:!st.showHelp}))},s.showHelp?'− Απόκρυψη εξήγησης':'+ Τύποι και ερμηνεία του Math'),
 s.showHelp?smEl('div',{className:'math-help'},
 smEl('p',null,'Για ίσα χρονικά βήματα: μέση τιμή = Σyₖ/N, RMS = √(Σyₖ²/N), ενέργεια ≈ Σ(yₖ+yₖ₊₁)Δt/2.'),
 smEl('p',null,'Παραδείγματα: v_d·i_d = ισχύς στην DC έξοδο της γέφυρας· v_a·i_a = ισχύς ανά φάση. Η στιγμιαία ισχύς στο πηνίο είναι p_L = v_d·i_d − R·i_d². Σε μόνιμη περιοδική κατάσταση ο μέσος όρος της p_L πρέπει να τείνει στο μηδέν.'),
 smEl('p',null,'Το Math υποστηρίζει συνδυασμούς καναλιών, χωρίς εκτέλεση αυθαίρετου κώδικα. Για πρόσθεση/αφαίρεση απαιτείται ίδιο φυσικό μέγεθος, ενώ η διαίρεση με μηδέν αγνοείται στις μετρήσεις.')):null);
 }
}
export {OscilloscopeMath,scopeCompress};
