import fs from 'node:fs';
import assert from 'node:assert/strict';
import {patternFeatures,trainingLabel,generatedPatterns} from './docs/pattern-features.mjs';
import {predict} from './docs/forest.mjs';
const model=JSON.parse(fs.readFileSync('docs/model.json','utf8'));
function sample(distances){return distances.map(distance=>({distance,valid:1}))}
function label(rows){const x=patternFeatures(rows),p=predict(model,x);return model.classes[p.indexOf(Math.max(...p))]}
assert.equal(label(sample(Array(30).fill(30))),'clean');
assert.equal(label(sample(Array.from({length:30},(_,i)=>30+i%2))),'clutter');
assert.equal(label(sample(Array.from({length:30},(_,i)=>30+(i%2)*10))),'weak_signal');
assert.equal(label(sample([...Array(15).fill(30),...Array(15).fill(233)])),'weak_signal');
assert.equal(label(sample(Array.from({length:30},(_,i)=>30+(i%2)*30))),'weak_signal');
assert.equal(label(Array.from({length:30},()=>({distance:0,valid:0}))),'weak_signal');
assert.equal(model.trees.length,10);
assert.deepEqual(model.classes,['clean','clutter','weak_signal']);
for(const generated of generatedPatterns())assert.equal(trainingLabel(generated.x),generated.label);
const html=fs.readFileSync('docs/index.html','utf8');assert.ok(!html.includes('classification-mode'));assert.ok(!html.includes('src="rules.js"'));assert.ok(!fs.readFileSync('docs/live.js','utf8').includes('classifyRules'));
console.log('Forest-only predictions: 1 cm / 10 cm boundaries, stable jump, nonmatching variation, missing echoes, and generated training labels passed.');

