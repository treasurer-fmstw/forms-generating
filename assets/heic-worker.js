'use strict';
self.onmessage=async event=>{
 try{
  const {heicTo}=await import('./vendor/heic-to/heic-to.js');
  const image=await heicTo({blob:event.data.file,type:'bitmap'});
  try{
   if(!image.width||!image.height)throw Error('圖片尺寸無效');
   const scale=Math.min(1,1600/Math.max(image.width,image.height));
   const canvas=new OffscreenCanvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const blob=await canvas.convertToBlob({type:'image/jpeg',quality:.9});
   self.postMessage({ok:true,blob});
  }finally{image.close();}
 }catch(e){self.postMessage({ok:false,error:typeof e==='string'?e:(e?.message||'無法解碼此 HEIC')});}
};
