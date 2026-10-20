'use strict';
window.HEIC=(()=>{
 const workerUrl=new URL('./heic-worker.js',document.currentScript.src).href;
 let queue=Promise.resolve();
 async function isHeic(file){
  if(/\.(heic|heif|hif)$/i.test(file.name||'')||/^image\/hei[cf](?:-sequence)?$/i.test(file.type||''))return true;
  const bytes=new Uint8Array(await file.slice(0,96).arrayBuffer()),text=new TextDecoder('ascii').decode(bytes);
  return text.slice(4,8)==='ftyp'&&/(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(text.slice(8));
 }
 function decode(file){return new Promise((resolve,reject)=>{
  let worker,timer;
  const finish=(error,blob)=>{clearTimeout(timer);if(worker)worker.terminate();error?reject(Error(error)):resolve(new File([blob],(file.name||'image').replace(/\.[^.]*$/,'')+'.jpg',{type:'image/jpeg'}));};
  try{
   if(file.size>FMSTW_CONFIG.maxFileBytes){finish('HEIC 超過單檔 12 MB 限制');return;}
   worker=new Worker(workerUrl,{type:'module'});
   timer=setTimeout(()=>finish('HEIC 轉檔逾時，請換較小檔案或轉成 JPG 後重試'),90000);
   worker.onerror=()=>finish('HEIC 解碼器載入失敗，請重新整理；若仍失敗，請確認網站已上傳 assets/vendor/heic-to');
   worker.onmessage=e=>{if(e.data.ok&&e.data.blob instanceof Blob&&e.data.blob.size)finish(null,e.data.blob);else finish('此 HEIC 無法轉檔，請確認檔案完整，或轉成 JPG 後重試');};
   worker.postMessage({file});
  }catch(e){finish('此瀏覽器無法啟動 HEIC 轉檔，請使用較新的 Safari、Chrome 或 Edge');}
 });}
 function convert(file){const task=queue.then(()=>decode(file));queue=task.catch(()=>{});return task;}
 return {isHeic,convert};
})();
heicToFile=file=>HEIC.convert(file);
loadImage=async function(file){
 if(await HEIC.isHeic(file)){
  // Prefer native decoding when available (including device orientation handling).
  try{return await loadImageRaw(file);}catch{}
  file=await HEIC.convert(file);
 }
 return loadImageRaw(file);
};
