import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import MOTOR_QUESTIONS from '../src/quiz.js';
import RECT_QUESTIONS from '../src/rectifier-quiz.js';
// Render and exercise the actual UI class without network/DOM side effects.
const base=new URL('../',import.meta.url);
function appHarness(quizEnabled=false){
 class Component{constructor(props){this.props=props;}setState(update,callback){this.state={...this.state,...(typeof update==='function'?update(this.state):update)};callback?.();}}
 const ctx={React:{Component,createElement:(tag,props,...children)=>({tag,props:props||{},children:children.flat(Infinity)})},ReactDOM:{render(){}},document:{getElementById(){return null}},localStorage:{getItem(){return null},setItem(){}},structuredClone,performance,console,setTimeout,clearTimeout,URL,Blob};
 const files=['src/engine/topology.js','src/engine/motor-dynamics.js','src/engine/rectifier.js','src/engine/scope-math.js','src/oscilloscope.js','src/oscilloscope-math.js','src/rectifier-ui.js','src/main.js'];
 const code=files.map(f=>fs.readFileSync(new URL(f,base),'utf8').replace(/^import .*$/gm,'').replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm,'')).join('\n');
 vm.createContext(ctx);vm.runInContext('const QUIZ='+JSON.stringify(quizEnabled?MOTOR_QUESTIONS:[])+';const RECT_QUIZ='+JSON.stringify(quizEnabled?RECT_QUESTIONS:[])+';const __HAS_QUIZ__='+quizEnabled+';const __HAS_RECT__=true;'+code+'\nthis.AppClass=App;this.ScopeClass=ScopeChart;this.RectClass=RectifierLab;this.MathClass=OscilloscopeMath;',ctx);
 return {app:new ctx.AppClass({}),ctx};
}
function elements(tree,out=[]){if(!tree||typeof tree!=='object')return out;if(Array.isArray(tree)){tree.forEach(x=>elements(x,out));return out;}out.push(tree);tree.children?.forEach(x=>elements(x,out));return out;}
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(typeof tree!=='object')return String(tree);if(Array.isArray(tree))return tree.map(text).join(' ');return (tree.children||[]).map(text).join(' ');}
test('all UI tabs and scopes render without missing variables / invalid chart coordinates',()=>{
 const {app,ctx}=appHarness();
 for(const tab of ['workspace','control','dynamics','rectifier','help']){
  app.patch({tab});const tree=app.render();assert.ok(tree);
  for(const node of elements(tree))if(node.tag===ctx.ScopeClass){const chart=new ctx.ScopeClass(node.props),rendered=chart.render();assert.ok(!text(rendered).includes('NaN'));for(const path of elements(rendered).filter(n=>n.tag==='path'))assert.ok(!String(path.props.d).includes('NaN'));}
 }
 const rect=new ctx.RectClass({questions:[]});assert.ok(rect.render());
});
test('230V UI starts, shares graph/live readings, and STOP clears live currents/torque',()=>{
 const {app}=appHarness();app.changePlate('230/400');app.patch({vl:230});app.start();assert.equal(app.state.run,'STAR');assert.ok(app.state.live.current>0);assert.equal(app.state.live.current,app.state.live.currentPhase);
 const g=app.audit().star;assert.ok(Math.abs(g.lineCurrent-app.state.live.current)<1e-8);
 app.stop();assert.equal(app.state.live.current,0);assert.equal(app.state.live.currentPhase,0);assert.equal(app.state.live.torque,0);assert.ok(text(app.render()).includes('ΠΡΟΕΠΙΣΚΟΠΗΣΗ'));
});
test('UI blocks 230/400 at 400V for Y-Delta and permits permanent Y',()=>{
 const {app}=appHarness();app.changePlate('230/400');app.patch({vl:400});assert.equal(app.getPrediction().length,0);app.start();assert.equal(app.state.run,'OFF');assert.ok(app.state.alert.includes('START αποκλείστηκε'));
 app.patch({startMode:'star'});app.start();assert.equal(app.state.run,'STAR');assert.ok(Math.abs(app.state.live.voltagePhase-400/Math.sqrt(3))<1e-8);
});
test('changing electrical parameters clears stale history; impedance calibration validates reference load',()=>{
 const {app}=appHarness();app.start();assert.ok(app.state.history.length);app.patch({vl:230});assert.equal(app.state.history.length,0);assert.equal(app.state.run,'OFF');
 app.patch({zTarget:20});app.applyImpedance();app.start();assert.equal(app.state.run,'OFF');assert.ok(app.state.alert.includes('τριβές'));
});
test('dead time topology and current scopes do not render a healthy delta connection',()=>{
 const {app}=appHarness();app.patch({run:'DEAD',speed:.4,time:4.1});const t=text(app.render());assert.ok(t.includes('ΝΕΚΡΟΣ ΧΡΟΝΟΣ'));assert.ok(!t.includes('Δ: τρεις κόμβοι'));
});

test('F3 relocation resets live current instead of leaving energized OFF readings',()=>{const {app}=appHarness();app.start();assert.ok(app.state.live.current>0);app.changeF3('winding');assert.equal(app.state.run,'OFF');assert.equal(app.state.live.current,0);assert.equal(app.state.live.currentPhase,0);assert.equal(app.state.live.torque,0);});

test('v4.2 rectifier Math/Measure and advanced theory render alongside corrected motor scopes',()=>{const {ctx}=appHarness();const rect=new ctx.RectClass({questions:[]});rect.setState({mathOpen:true,theoryLevel:'advanced'});const tree=rect.render(),nodes=elements(tree);const math=nodes.find(n=>n.tag===ctx.MathClass);assert.ok(math,'MATH/MEASURE component missing');const rendered=new ctx.MathClass(math.props).render();assert.ok(text(rendered).includes('MATH / MEASURE'));assert.ok(text(tree).includes('Ισοζύγιο ενέργειας'));for(const n of elements(rendered))if(n.tag===ctx.ScopeClass){const scope=new ctx.ScopeClass(n.props);assert.ok(!text(scope.render()).includes('NaN'));}});

test('torque controls use the common event model, reset changed experiments, and keep two load characteristics',()=>{
 const {app,ctx}=appHarness();app.patch({tab:'dynamics'});
 let tree=app.render(),content=text(tree);
 assert.ok(content.includes('Αρχική ροπή φορτίου (N·m)'));assert.ok(content.includes('Ροπή φορτίου μετά τη μετάβαση Δ (N·m)'));
 assert.ok(content.includes('TL: 10 → 60 N·m'));
 const characteristics=elements(tree).find(x=>x.tag===ctx.ScopeClass&&x.props.options.title==='Te(s) και συνολική αντιρροπή TL+Bω [N·m]');
 assert.equal(characteristics.props.series.filter(x=>x.name.startsWith('TL')).length,2);
 const prediction=app.getPrediction(),after=prediction.find(x=>x.run==='DELTA');assert.equal(after.load,60);
 app.start();app.patch({loadTorqueNm:12,deltaLoadTorqueNm:65});assert.equal(app.state.run,'OFF');assert.equal(app.state.history.length,0);assert.equal(app.state.live.load,12);
 app.patch({loadUnit:'percent',loadPct:25});content=text(app.render());assert.ok(content.includes('25%'));assert.ok(!content.includes('Αρχική ροπή φορτίου (N·m)'));
});

test('FULL edition renders all restored motor questions and rectifier exercises; PUBLIC omits quiz navigation',()=>{
 if(!MOTOR_QUESTIONS.length){assert.equal(RECT_QUESTIONS.length,0);assert.ok(!text(appHarness().app.render()).includes('Εξάσκηση ·'));return;}
 assert.equal(MOTOR_QUESTIONS.length,36);assert.equal(RECT_QUESTIONS.length,12);
 const {app,ctx}=appHarness(true);assert.ok(text(app.render()).includes('Εξάσκηση · 36'));
 for(let i=0;i<MOTOR_QUESTIONS.length;i++){
  const question=MOTOR_QUESTIONS[i];assert.ok(question.options[question.correct]);assert.ok(question.why);
  app.patch({tab:'quiz',quizIndex:i});const tree=app.render();assert.ok(text(tree).includes(question.prompt));
 }
 const rect=new ctx.RectClass({questions:RECT_QUESTIONS});assert.ok(rect.render());
 assert.ok(!text(appHarness().app.render()).includes('Εξάσκηση ·'));
});
