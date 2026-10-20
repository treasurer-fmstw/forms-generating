'use strict';
window.LocalDB={
 connection:null,
 async open(){
  if(this.connection)return this.connection;
  this.connection=await new Promise((resolve,reject)=>{
   const r=indexedDB.open('fmstw-v2',1);
   r.onupgradeneeded=()=>r.result.createObjectStore('kv');
   r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('請關閉其他舊版分頁後重試'));
   r.onsuccess=()=>resolve(r.result);
  });return this.connection;
 },
 async operation(mode,fn){
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('kv',mode);let value;
   tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||Error('本機儲存中斷'));tx.onerror=()=>reject(tx.error);
   try{const req=fn(tx.objectStore('kv'));req.onsuccess=()=>{value=req.result;};}catch(e){tx.abort();reject(e);}
  });
 },
 get(key){return this.operation('readonly',s=>s.get(key));},
 put(key,value){return this.operation('readwrite',s=>s.put(value,key));},
 remove(key){return this.operation('readwrite',s=>s.delete(key));},
 async entries(prefix){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('kv'),out=[];const r=tx.objectStore('kv').openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(String(c.key).startsWith(prefix))out.push([c.key,c.value]);c.continue();}};tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error);});},
 // Read / check / write in one IndexedDB transaction, including across browser tabs.
 async mutate(key,fn){const db=await this.open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('kv','readwrite'),s=tx.objectStore('kv');let out;
  tx.oncomplete=()=>resolve(out);tx.onabort=()=>reject(out instanceof Error?out:tx.error||Error('儲存失敗'));
  const req=s.get(key);req.onsuccess=()=>{try{out=fn(req.result);s.put(out,key);}catch(e){out=e;tx.abort();}};
 });}
};
