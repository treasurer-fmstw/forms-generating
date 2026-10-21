'use strict';
window.buildDocumentPdf=async function(data,cfg){
 const config=FMSTW_CONFIG;
 const localKai=await LocalDB.get('font:kai'),localTimes=await LocalDB.get('font:times');
 if((!config.kaiFontUrl&&!localKai)||(!config.timesFontUrl&&!localTimes))throw Error('系統 PDF 字型尚未完成配置，未產生檔案。請由管理者完成部署設定；填單者不需要自行設定字型。');
 await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/pdfmake.min.js');
 await loadScriptOnce('https://cdn.jsdelivr.net/npm/html-to-pdfmake@2.5.20/browser.js');
 renderSheets(data);
 const pages=[...document.querySelectorAll('#pvBody .page')];
 if(!pages.length)throw Error('尚未產生正式版面');
 const kai=localKai?'local-kai.ttf':config.kaiFontUrl,times=localTimes?'local-times.ttf':config.timesFontUrl;
 const vfs={};if(localKai)vfs[kai]=localKai.b64;if(localTimes)vfs[times]=localTimes.b64;
 const fonts={Kai:{normal:kai,bold:kai,italics:kai,bolditalics:kai},Times:{normal:times,bold:times,italics:times,bolditalics:times}};
 // Use rich text runs to prevent Chinese falling back into a Latin-only font.
 function mapFonts(node){
  if(Array.isArray(node)){node.forEach(mapFonts);return;}
  if(!node||typeof node!=='object')return;
  if(typeof node.text==='string'){
   const chunks=node.text.match(/[\x00-\x7F]+|[^\x00-\x7F]+/g)||[''];
   node.text=chunks.map(text=>({text,font:/^[\x00-\x7F]*$/.test(text)?'Times':'Kai'}));
  }
  for(const k of ['stack','columns','ul','ol'])if(node[k])mapFonts(node[k]);
  if(node.table){
   const cols=Math.max(...node.table.body.map(row=>row.length));node.table.widths=Array(cols).fill('*');
   const textOf=n=>typeof n==='string'?n:Array.isArray(n)?n.map(textOf).join(''):n&&typeof n==='object'?textOf(n.text||n.stack||''):'';
   const signatureRows=new Set();node.table.body.forEach((row,i)=>{const labels=row.map(textOf).map(x=>x.trim());if(labels.length===cfg.roles.length&&labels.every((v,j)=>v===cfg.roles[j]))signatureRows.add(i+1);});
   if(signatureRows.size){node.table.heights=i=>signatureRows.has(i)?62:undefined;node.table.dontBreakRows=true;}
   mapFonts(node.table.body);
  }
 }
 const content=[];
 for(const [index,page]of pages.entries()){
  const clone=page.cloneNode(true);clone.querySelectorAll('.pn,.receipt-controls,button,input,colgroup').forEach(n=>n.remove());
  for(const img of clone.querySelectorAll('img')){
   const src=img.getAttribute('src')||'';
   if(!/^data:image\/(png|jpeg|webp);base64,/.test(src)){img.remove();continue;}
   img.removeAttribute('style');img.setAttribute('width',img.classList.contains('pasteimg')?'280':'450');
   if(img.classList.contains('sig-fixed'))img.setAttribute('width','90');
  }
  // Fixed CSS pixel/mm dimensions are not portable to PDF points; tables auto-fit the page.
  clone.querySelectorAll('[style]').forEach(el=>el.removeAttribute('style'));
  clone.querySelectorAll('[width]').forEach(el=>{if(el.tagName!=='IMG')el.removeAttribute('width');});
  for(const el of clone.querySelectorAll('.org'))el.setAttribute('style','font-size:22pt;text-align:center;margin-bottom:8pt');
  for(const el of clone.querySelectorAll('.sec,.paste-title'))el.setAttribute('style','font-size:16pt;text-align:center;margin-bottom:10pt');
  for(const el of clone.querySelectorAll('.fdate'))el.setAttribute('style','font-size:11pt;text-align:center;margin-bottom:8pt');
  for(const el of clone.querySelectorAll('.rh')){el.setAttribute('style','font-size:9pt;margin-bottom:12pt');if(el.children.length>1)el.children[0].append(document.createTextNode('　　'));}
  const walker=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT);const whitespace=[];while(walker.nextNode()){if(!walker.currentNode.textContent.trim())whitespace.push(walker.currentNode);}whitespace.forEach(n=>n.remove());
  const converted=htmlToPdfmake(clone.innerHTML,{window,tableAutoSize:false,defaultStyles:{p:{margin:[0,3,0,4]},table:{margin:[0,2,0,6]},td:{margin:[2,2,2,2]},th:{bold:false},h1:{fontSize:20},h2:{fontSize:15}}});
  mapFonts(converted);content.push({stack:converted,...(index?{pageBreak:'before'}:{})});
 }
 const def={pageSize:'A4',pageMargins:[40,32,40,32],defaultStyle:{font:'Kai',fontSize:10,lineHeight:1.15},content,
  info:{title:data.docNo,subject:cfg.label,creator:'FMSTW 單據工作台'},footer:(page,pages)=>({text:page+' / '+pages,alignment:'right',font:'Times',fontSize:9,margin:[0,0,40,0]})};
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('PDF 產生逾時，請減少附件後重試；單據資料仍保留')),60000);try{pdfMake.createPdf(def,null,fonts,vfs).getBlob(blob=>{clearTimeout(timer);resolve(blob);});}catch(e){clearTimeout(timer);reject(e);}});
};
