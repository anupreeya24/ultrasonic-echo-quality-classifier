const FEATURE_NAMES=['valid_fraction','distance_mean','distance_std','distance_min','distance_max','distance_median','distance_iqr','session_range','stable_jump_cm','consecutive_diff_mean','consecutive_diff_max'];
function patternFeatures(rows){const values=rows.filter(r=>r.valid===1).map(r=>r.distance).sort((a,b)=>a-b),fraction=values.length/rows.length;
 const percentile=q=>{let p=(values.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return values[lo]+(values[hi]-values[lo])*(p-lo)};
 let stableJump=0;for(let i=10;i<rows.length;i++){const plateau=rows.slice(i-10,i);if(rows[i].valid!==1||plateau.some(r=>r.valid!==1))continue;const d=plateau.map(r=>r.distance);if(Math.max(...d)-Math.min(...d)<=1+1e-8)stableJump=Math.max(stableJump,Math.abs(rows[i].distance-d.reduce((a,b)=>a+b,0)/10));}
 const diffs=[];for(let i=1;i<rows.length;i++)if(rows[i-1].valid===1&&rows[i].valid===1)diffs.push(Math.abs(rows[i].distance-rows[i-1].distance));
 const diffMean=diffs.length?diffs.reduce((a,b)=>a+b,0)/diffs.length:0,diffMax=diffs.length?Math.max(...diffs):0;
 if(!values.length)return [fraction,0,0,0,0,0,0,0,0,0,0];const mean=values.reduce((a,b)=>a+b,0)/values.length,sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length),range=values.at(-1)-values[0];return [fraction,mean,sd,values[0],values.at(-1),percentile(.5),percentile(.75)-percentile(.25),range,stableJump,diffMean,diffMax];}
