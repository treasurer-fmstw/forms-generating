'use strict';
window.Service=(()=>{
 const config=window.FMSTW_CONFIG,local=config.mode!=='cloud';
 let bridge=null,peer=null,peerOrigin='',ready=null;const pending=new Map();
 const nonce=crypto.randomUUID();
 function connect(){
  if(ready)return ready;
  ready=new Promise((resolve,reject)=>{
   if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.appsScriptUrl))return reject(Error('尚未設定有效的資料服務網址'));
   const timer=setTimeout(()=>reject(Error('資料服務未連線，請保留草稿並重試')),25000);
   window.addEventListener('message',e=>{
    const m=e.data;if(!m||m.channel!==nonce)return;
    if(!peer){
     if(m.kind!=='ready'||!/^https:\/\/[\w-]+\.googleusercontent\.com$/.test(e.origin))return;
     peer=e.source;peerOrigin=e.origin;clearTimeout(timer);resolve();return;
    }
    if(e.source!==peer||e.origin!==peerOrigin)return;
    const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);
    m.error?p.reject(Error(m.error)):p.resolve(m.result);
   });
   bridge=document.createElement('iframe');bridge.hidden=true;bridge.title='資料連線';
   bridge.src=config.appsScriptUrl+'?bridge=1&origin='+encodeURIComponent(location.origin)+'&channel='+nonce;
   document.body.append(bridge);
  });return ready;
 }
 async function rpc(action,payload={}){
  if(local)return localCall(action,payload);
  await connect();const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('回應逾時。請保留目前內容，再查詢是否已儲存；不要另建重複單據'));},90000);pending.set(id,{resolve,reject,timer});peer.postMessage({channel:nonce,id,action,payload},peerOrigin);});
 }
 function token(){const a=new Uint8Array(32);crypto.getRandomValues(a);return Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');}
 async function localCall(action,p){
  if(action==='list')return(await LocalDB.entries('record:')).map(([,r])=>({docNo:r.data.docNo,formType:r.data.formType,version:r.version,status:r.status,updatedAt:r.updatedAt,next:FMSTW.nextRole(r)}));
  if(action==='save'){
   FMSTW.validate(p.data,!!p.submit);
   return LocalDB.mutate('record:'+p.data.docNo,current=>{
    if(current&&current.lastRequest===p.requestId)return current;
    if(current){if(p.editToken!==current.editToken)throw Error('修改碼不正確');FMSTW.checkVersion(current.version,p.version);if(current.signatures.length!==(p.signatureCount||0))throw Error('載入後已有新的簽章，請重新載入再修改');}
    if(current&&current.data.formType!==p.data.formType)throw Error('不能更改既有單據的單別');
    return {data:p.data,version:(current?.version||0)+1,editToken:current?.editToken||p.editToken||token(),signToken:p.createSignToken||token(),signatures:[],pdf:null,status:p.submit?'待簽核':'草稿',updatedAt:new Date().toISOString(),lastRequest:p.requestId,
     history:[...(current?.history||[]),...(current?[{data:current.data,version:current.version,signatures:current.signatures,pdf:current.pdf,updatedAt:current.updatedAt}]:[])]};
   });
  }
  const current=await LocalDB.get('record:'+p.docNo);if(!current)throw Error('找不到單據');
  const edit=p.editToken===current.editToken,sign=p.signToken===current.signToken;
  if(!edit&&!sign)throw Error('存取碼不正確');
  if(action==='get')return edit?current:{data:current.data,version:current.version,signatures:current.signatures,pdf:current.pdf,status:current.status};
  if(action==='pdf'||action==='sign')return LocalDB.mutate('record:'+p.docNo,r=>{
   if(r.lastRequest===p.requestId)return r;
   FMSTW.checkVersion(r.version,p.version);
   if(r.status==='草稿')throw Error('請先正式送出單據再簽核');
   if(!/^JVBERi0/.test(p.b64||''))throw Error('不是有效 PDF');
   if(action==='pdf'){
    if(p.editToken!==r.editToken)throw Error('無修改權限');
    if(r.signatures.length)throw Error('已簽版本不能替換原始 PDF');
   }else{
    if(p.signToken!==r.signToken)throw Error('簽核碼已失效');
    if(p.expectedCount!==r.signatures.length||FMSTW.nextRole(r)!==p.role)throw Error('簽核進度已變更，請重新載入');
    if(!r.pdf)throw Error('請先由填單者上傳原始 PDF');
    r.signatures.push({role:p.role,at:new Date().toISOString(),identity:'持簽核碼者（未驗證本人）'});
   }
   r.pdf={b64:p.b64,name:p.name};r.updatedAt=new Date().toISOString();r.lastRequest=p.requestId;
   r.status=FMSTW.nextRole(r)?'待簽核':'簽核完成';return r;
  });
  throw Error('不支援的操作');
 }
 return {rpc,local,token};
})();
// Compatibility adapter keeps retained forms independent of their old hosting environment.
window.google={script:{get run(){
 let ok=()=>{},bad=e=>console.error(e);
 const runner=new Proxy({}, {get(_,name){
  if(name==='withSuccessHandler')return fn=>{ok=fn;return runner;};
  if(name==='withFailureHandler')return fn=>{bad=fn;return runner;};
  return (...args)=>Promise.resolve().then(()=>window.compatCall(name,...args)).then(ok).catch(bad);
 }});return runner;
}}};
window.compatCall=async(name,...args)=>{
 if(name==='getAppUrl')return new URL('index.html',location.href).href;
 if(name==='getFormTypes')return Object.entries(FMSTW.types).map(([key,v])=>({key,...v}));
 if(name==='getCloudRoles')return [];
 if(name==='getBankProfile')return LocalDB.get('bankProfile');
 if(name==='saveBankProfile'){await LocalDB.put('bankProfile',args[0]);return '已儲存於這台裝置；不會自動分享給其他人';}
 throw Error('此操作尚未接上新版資料服務：'+name);
};
