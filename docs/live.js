function quantile(sorted, q) { const at=(sorted.length-1)*q,lo=Math.floor(at),hi=Math.ceil(at);return sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo); }
function sessionFeatures(rows){return patternFeatures(rows);}
function forestProbabilities(model, features) {
  // sklearn trees receive float32 feature values during inference.
  const x=features.map(Math.fround),prob=model.classes.map(()=>0);
  for(const tree of model.trees){let node=0;while(tree.left[node]!==-1)node=x[tree.feature[node]]<=tree.threshold[node]?tree.left[node]:tree.right[node];tree.probabilities[node].forEach((p,i)=>prob[i]+=p/model.trees.length)}
  return prob;
}
const liveStatus=document.getElementById('live-status'),connectButton=document.getElementById('connect'),disconnectButton=document.getElementById('disconnect'),prediction=document.getElementById('prediction'),progress=document.getElementById('live-progress'),distanceDisplay=document.getElementById('live-distance'),probabilityDisplay=document.getElementById('probabilities');
let liveModel=null,port=null,reader=null,active=false,currentSession=null,windowRows=[],nextIndex=0,sessionBad=false,lastData=0;
fetch('model.json').then(r=>{if(!r.ok)throw Error('Model download failed');return r.json()}).then(m=>{liveModel=typeof storedActiveModel!=='undefined'&&storedActiveModel?storedActiveModel:m;connectButton.disabled=!('serial' in navigator);liveStatus.textContent='serial' in navigator?'Model ready. Connect your ESP32, then press RESET/EN once.':'Open this page in desktop Chrome or Edge to connect over USB.'}).catch(e=>{liveStatus.textContent=e.message});
function resetWindow(){currentSession=null;windowRows=[];nextIndex=0;sessionBad=false;progress.textContent='Waiting for reading 0 / 30';}
function acceptLine(line){
  if(!line||line.startsWith('session_id,'))return;
  const p=line.split(',');
  if(p.length!==5||!/^live_\d+$/.test(p[0])){resetWindow();liveStatus.textContent='Unreadable line; waiting for the next complete session.';return}
  const index=Number(p[1]),duration=Number(p[2]),distance=Number(p[3]),valid=Number(p[4]);
  if(p.slice(1).some(v=>!v.trim())||![index,duration,distance,valid].every(Number.isFinite)||!Number.isInteger(index)||index<0||index>=30||duration<0||distance<0||![0,1].includes(valid)){resetWindow();return}
  lastData=Date.now();distanceDisplay.textContent=valid?distance.toFixed(2)+' cm':'No echo';
  if(p[0]!==currentSession){currentSession=p[0];windowRows=[];nextIndex=0;sessionBad=index!==0;prediction.textContent='Collecting…';probabilityDisplay.replaceChildren();}
  if(index!==nextIndex)sessionBad=true;
  nextIndex=index+1;windowRows.push({distance,valid,duration});progress.textContent=windowRows.length+' / 30 readings';
  if(sessionBad){liveStatus.textContent='Missing reading; skipping this session.';return}
  liveStatus.textContent='Receiving live sensor data.';
  if(index===29&&windowRows.length===30){const features=sessionFeatures(windowRows),probabilities=forestProbabilities(liveModel,features),best=probabilities.indexOf(Math.max(...probabilities)),selected=liveModel.classes[best];prediction.textContent=selected.replaceAll('_',' ');probabilityDisplay.replaceChildren();const context=document.createElement('div');context.textContent='Session range: '+features[7].toFixed(2)+' cm · largest jump after 10 stable readings: '+features[8].toFixed(2)+' cm';probabilityDisplay.append(context);liveModel.classes.forEach((name,i)=>{const el=document.createElement('div');el.textContent=name.replaceAll('_',' ')+': '+(probabilities[i]*100).toFixed(1)+'% forest score';probabilityDisplay.append(el)});recordCompleted(windowRows,features,probabilities,selected,currentSession);liveStatus.textContent='Random forest classified the complete session.';}
}
async function stopLive(){active=false;if(reader)try{await reader.cancel()}catch{} }
connectButton.addEventListener('click',async()=>{
  if(active||!liveModel)return;connectButton.disabled=true;
  try{port=await navigator.serial.requestPort();await port.open({baudRate:115200});active=true;disconnectButton.disabled=false;resetWindow();prediction.textContent='Collecting…';liveStatus.textContent='Connected. Press RESET/EN once if readings do not appear.';lastData=Date.now();const decoder=new TextDecoder();let buffer='';reader=port.readable.getReader();while(active){const{value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){let line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);acceptLine(line)}if(buffer.length>16384){buffer='';resetWindow();}}}
  catch(e){liveStatus.textContent=e.name==='NotFoundError'?'No port selected.':e.message+' Close Serial Monitor and record_csv.py, then reconnect.';}
  finally{active=false;if(reader){reader.releaseLock();reader=null}if(port){try{await port.close()}catch{}port=null}disconnectButton.disabled=true;connectButton.disabled=!liveModel||!('serial' in navigator);prediction.textContent='Disconnected';probabilityDisplay.replaceChildren();resetWindow();if(!liveStatus.textContent.includes('Close')&&!liveStatus.textContent.includes('selected'))liveStatus.textContent='Disconnected. Connect again to resume.';}
});
disconnectButton.addEventListener('click',stopLive);
setInterval(()=>{if(active&&Date.now()-lastData>6000){prediction.textContent='Waiting for data';probabilityDisplay.replaceChildren();liveStatus.textContent='No recent readings. Check the USB cable and press RESET/EN if your sketch has stopped.';}},1000);
