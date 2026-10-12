import {FEATURE_NAMES,generatedPatterns} from './pattern-features.mjs';
export const CLASSES=['clean','clutter','weak_signal'];
export const FEATURES=FEATURE_NAMES;
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function shuffle(a,random){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function predict(model,features){const x=features.map(Math.fround),p=model.classes.map(()=>0);for(const t of model.trees){let n=0;while(t.left[n]!==-1)n=x[t.feature[n]]<=t.threshold[n]?t.left[n]:t.right[n];t.probabilities[n].forEach((v,i)=>p[i]+=v/model.trees.length)}return p}
export function trainForest(samples,{seed=42,trees=10,maxDepth=7,minLeaf=2}={}){
 const random=rng(seed),groups=CLASSES.map(c=>samples.filter(s=>s.label===c));if(groups.some(g=>g.length<2))throw Error('Training needs at least two sessions in every class.');
 const forest=[];
 for(let t=0;t<trees;t++){
  const tree={left:[],right:[],feature:[],threshold:[],probabilities:[]};
  const perClass=Math.max(2,Math.ceil(samples.length/CLASSES.length));
  const bootstrap=groups.flatMap(g=>Array.from({length:perClass},()=>g[Math.floor(random()*g.length)]));
  function build(rows,depth){const n=tree.left.length,counts=CLASSES.map(c=>rows.filter(r=>r.label===c).length);tree.left.push(-1);tree.right.push(-1);tree.feature.push(-2);tree.threshold.push(-2);tree.probabilities.push(counts.map(c=>c/rows.length));if(depth>=maxDepth||rows.length<minLeaf*2||counts.filter(Boolean).length===1)return n;
   let best=null;const dims=shuffle(FEATURES.map((_,i)=>i),random).slice(0,Math.floor(Math.sqrt(FEATURES.length)));
   for(const dim of dims){const values=[...new Set(rows.map(r=>Math.fround(r.x[dim])))].sort((a,b)=>a-b);let cuts=values.slice(0,-1).map((v,i)=>(v+values[i+1])/2);if(cuts.length>40)cuts=shuffle(cuts,random).slice(0,40);
    for(const cut of cuts){const a=rows.filter(r=>Math.fround(r.x[dim])<=cut),b=rows.filter(r=>Math.fround(r.x[dim])>cut);if(a.length<minLeaf||b.length<minLeaf)continue;const impurity=g=>1-CLASSES.reduce((sum,c)=>sum+(g.filter(r=>r.label===c).length/g.length)**2,0);const score=(a.length*impurity(a)+b.length*impurity(b))/rows.length;if(!best||score<best.score)best={dim,cut,a,b,score}}
   }
   const parent=1-counts.reduce((sum,c)=>sum+(c/rows.length)**2,0);if(!best||best.score>=parent-1e-12)return n;tree.feature[n]=best.dim;tree.threshold[n]=best.cut;tree.left[n]=build(best.a,depth+1);tree.right[n]=build(best.b,depth+1);return n;
  }
  build(bootstrap,0);forest.push(tree);
 }
 return {features:FEATURES,classes:CLASSES,trees:forest};
}
export function evaluate(model,samples){const matrix=CLASSES.map(()=>CLASSES.map(()=>0));for(const s of samples){const p=predict(model,s.x),pred=p.indexOf(Math.max(...p));matrix[CLASSES.indexOf(s.label)][pred]++}const correct=matrix.reduce((n,row,i)=>n+row[i],0);return {matrix,total:samples.length,correct,accuracy:samples.length?correct/samples.length:null}}
export function trainAndEvaluate(samples){
 const train=[],test=[];for(const label of CLASSES){const group=samples.filter(s=>s.label===label);if(group.every(s=>s.partition)){train.push(...group.filter(s=>s.partition==='train'));test.push(...group.filter(s=>s.partition==='test'));}else{const ordered=[...group].sort((a,b)=>(a.order??0)-(b.order??0));const split=Math.floor(ordered.length/2);train.push(...ordered.slice(0,split));test.push(...ordered.slice(split));}}
 if(!train.length||!test.length)throw Error('Add recorded sessions assigned to both training and test partitions.');
 // Select tree depth within the training half only. The external test half is untouched.
 const innerTrain=[],validation=[];for(const label of CLASSES){const group=train.filter(s=>s.label===label),n=Math.max(1,Math.floor(group.length*.25));innerTrain.push(...group.slice(0,-n));validation.push(...group.slice(-n));}
 const generated=generatedPatterns();let best=null;for(const depth of [4,7,10]){const candidate=trainForest([...innerTrain,...generated],{trees:10,maxDepth:depth});const metrics=evaluate(candidate,validation);if(!best||metrics.accuracy>best.score)best={depth,score:metrics.accuracy??0}}
 const model=trainForest([...train,...generated],{maxDepth:best.depth});const evaluation=evaluate(model,test);
 return {model,evaluation,trainingCount:train.length,testingCount:test.length,generatedCount:generated.length,depth:best.depth,trainIds:train.map(s=>s.id),testIds:test.map(s=>s.id)};
}
