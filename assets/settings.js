'use strict';
const $=id=>document.getElementById(id);
async function status(){for(const key of ['kai','times']){const font=await LocalDB.get('font:'+key);$(key+'Status').textContent=font?'已存於此裝置：'+font.name:'尚未選擇字型';}}
for(const key of ['kai','times'])$(key).onchange=async()=>{
 try{const file=$(key).files[0];if(!file)return;if(file.size>32*1024*1024)throw Error('字型超過 32 MB');const bytes=new Uint8Array(await file.arrayBuffer());if(!(bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0))throw Error('請使用 TrueType TTF 字型；TTC／OTF 尚未支援');
  let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));await LocalDB.put('font:'+key,{name:file.name,b64:btoa(binary)});await status();$('status').textContent='已存於這台瀏覽器，未上傳。';
 }catch(e){$('status').textContent=e.message;}
};
$('clearFonts').onclick=async()=>{await LocalDB.remove('font:kai');await LocalDB.remove('font:times');await status();};status().catch(e=>$('status').textContent=e.message);
