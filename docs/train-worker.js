import {trainAndEvaluate} from './forest.mjs';
self.onmessage=event=>{try{self.postMessage({ok:true,...trainAndEvaluate(event.data.samples)})}catch(e){self.postMessage({ok:false,error:e.message})}};
