/* OCR runs in a browser worker. Documents are never posted to an OCR service.
 * CDN requests download public engines/models only. Dependencies load on demand. */
window.ExpenseReader=(function(){
'use strict';
let pdfPromise,enginePromise;
function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Téléchargement du moteur de lecture impossible. Vérifiez la connexion.'));};document.head.append(s);});}
async function pdfEngine(){if(!pdfPromise)pdfPromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.mjs').then(p=>{p.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.worker.mjs';return p;}).catch(e=>{pdfPromise=null;throw e;});return pdfPromise;}
async function ocrEngine(){if(!enginePromise)enginePromise=script('https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js').catch(e=>{enginePromise=null;throw e;});await enginePromise;return window.Tesseract;}
function textLines(items){const rows=[];for(const item of items){if(!item.str)continue;const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<3);if(!row){row={y,items:[]};rows.push(row);}row.items.push(item);}return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ')).join('\n');}
async function read(files,onProgress=()=>{},signal){
 let worker,document=null,activePage=0;const pages=[];
 const check=()=>{if(signal?.aborted)throw Error('Lecture annulée. Aucune facture enregistrée.');};
 const cancel=()=>{if(worker)worker.terminate();if(document)document.destroy();};signal?.addEventListener('abort',cancel,{once:true});
 const recognize=async image=>{check();if(!worker){onProgress('Chargement du moteur de lecture local…');const engine=await ocrEngine();check();worker=await engine.createWorker('eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',logger:m=>{if(m.status==='recognizing text')onProgress('Lecture de la page '+activePage+' · '+Math.round(m.progress*100)+' %');}});await worker.setParameters({tessedit_pageseg_mode:'6'});}check();const result=await worker.recognize(image);check();return result.data.text;};
 try{for(const file of files){check();if(file.size>5*1024*1024)throw Error('Chaque justificatif doit rester inférieur à 5 Mo.');if(file.type==='application/pdf'){
   const engine=await pdfEngine();check();document=await engine.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
   if(document.numPages+pages.length>15)throw Error('Maximum 15 pages par lecture ; scindez les documents plus longs.');
   for(let pageNo=1;pageNo<=document.numPages;pageNo++){check();activePage++;onProgress('Lecture de la page '+pageNo+'/'+document.numPages);const page=await document.getPage(pageNo),content=await page.getTextContent();let text=textLines(content.items);
    if(text.replace(/\s/g,'').length<80){const natural=page.getViewport({scale:1}),viewport=page.getViewport({scale:2000/Math.max(natural.width,natural.height)}),canvas=window.document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);try{await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;text=await recognize(canvas);}finally{canvas.width=0;canvas.height=0;}}
    pages.push(text);page.cleanup();
   }
   await document.destroy();document=null;
  }else if(['image/png','image/jpeg'].includes(file.type)){activePage++;pages.push(await recognize(file));}else throw Error('Formats de lecture : PDF, JPG ou PNG.');}
  check();return pages;
 }finally{signal?.removeEventListener('abort',cancel);if(worker)await worker.terminate().catch(()=>{});if(document)await document.destroy().catch(()=>{});}
}
return {read};
})();
