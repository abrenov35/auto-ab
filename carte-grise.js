/* AUTO-AB v8.86 — Carte grise dédiée + correctif entretien */
(function () {
  'use strict';
  let currentCarteGrise=null,originalCloseDocModal=null,originalOpenAddDocumentModal=null;
  const normalize=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const docId=d=>d?.id??d?.idDocument??'',docName=d=>d?.nom||d?.nomFichier||'Carte grise',docLink=d=>d?.lienDrive||d?.lien||d?.url||'',docCategory=d=>normalize(d?.categorie||d?.type||''),docVehicle=d=>String(d?.immatriculation||d?.idVehicule||'').trim();
  function activeVehicle(){return String((typeof vehicleDetailImmat!=='undefined'&&vehicleDetailImmat)||(typeof selectedVehicule!=='undefined'&&selectedVehicule)||localStorage.getItem('activeVehicleAB')||'').trim();}
  function findCarteGrise(immat){const docs=Array.isArray(window.data?.documents)?window.data.documents:[];return docs.filter(d=>docVehicle(d)===immat&&(d.statut||'Actif')!=='Archivé'&&docCategory(d).includes('carte grise')).sort((a,b)=>String(b.dateUpload||b.date||'').localeCompare(String(a.dateUpload||a.date||'')))[0]||null;}
  function injectStyles(){if(document.getElementById('carteGriseStyles'))return;const s=document.createElement('style');s.id='carteGriseStyles';s.textContent='.vehicle-registration-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px;padding:11px 13px;margin-bottom:12px;border:1px solid #dfe6ef;border-radius:9px;background:#f8fafc}.vehicle-registration-info{display:flex;align-items:center;gap:12px}.vehicle-registration-icon{width:36px;height:36px;border:1px solid #c9d7e8;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:#fff;color:#185fa5}.vehicle-registration-title{font-size:13px;font-weight:800;color:#102a43}.vehicle-registration-meta{font-size:11px;color:#667085}.vehicle-registration-actions{display:flex;gap:7px}.vehicle-registration-btn{min-height:32px;padding:0 10px;border:1px solid #9eb9da;border-radius:7px;background:#fff;color:#185fa5;font-size:11px;font-weight:700}.vehicle-registration-btn.primary{background:#185fa5;color:#fff;border-color:#185fa5}';document.head.appendChild(s);}
  window.renderVehicleDetailDocuments=function(){const box=document.getElementById('vehicleDetailDocuments');if(!box)return;const im=activeVehicle(),cg=findCarteGrise(im);box.innerHTML=cg?`<div class="vehicle-registration-row"><div class="vehicle-registration-info"><span class="vehicle-registration-icon"><i class="bi bi-card-text"></i></span><div><div class="vehicle-registration-title">Carte grise</div><div class="vehicle-registration-meta">${safeText(docName(cg))}</div></div></div><div class="vehicle-registration-actions"><button class="vehicle-registration-btn" onclick="viewCarteGriseFromDetail()">Voir</button><button class="vehicle-registration-btn" onclick="openCarteGriseFromDetail()">Remplacer</button></div></div>`:`<div class="vehicle-registration-row"><div class="vehicle-registration-info"><span class="vehicle-registration-icon"><i class="bi bi-card-text"></i></span><div><div class="vehicle-registration-title">Carte grise</div><div class="vehicle-registration-meta">Aucune carte grise enregistrée</div></div></div><div class="vehicle-registration-actions"><button class="vehicle-registration-btn primary" onclick="openCarteGriseFromDetail()">Ajouter</button></div></div>`;};
  function restoreDocumentModalButton(){const submit=document.querySelector('#docModal .form-actions .btn-success');if(submit){submit.onclick=window.submitDocument;submit.innerHTML='📤 Charger et enregistrer';}currentCarteGrise=null;}
  if(typeof window.closeDocModal==='function'){originalCloseDocModal=window.closeDocModal;window.closeDocModal=function(){const r=originalCloseDocModal.apply(this,arguments);restoreDocumentModalButton();return r;};}
  if(typeof window.openAddDocumentModal==='function'){originalOpenAddDocumentModal=window.openAddDocumentModal;window.openAddDocumentModal=function(){restoreDocumentModalButton();return originalOpenAddDocumentModal.apply(this,arguments);};}
  window.openCarteGriseFromDetail=function(){const im=activeVehicle();if(!im)return showMsg('Aucun véhicule sélectionné','err');selectedVehicule=im;currentCarteGrise=findCarteGrise(im);originalOpenAddDocumentModal?originalOpenAddDocumentModal():openAddDocumentModal();const submit=document.querySelector('#docModal .form-actions .btn-success');if(submit)submit.onclick=window.saveCarteGriseFromDetail;};
  window.viewCarteGriseFromDetail=function(){const d=findCarteGrise(activeVehicle());if(!d||!docLink(d))return showMsg('Aucune carte grise disponible','err');viewDocument(docName(d),docLink(d),d.type||d.categorie||'Carte grise');};
  window.saveCarteGriseFromDetail=async function(){const im=activeVehicle(),file=typeof selectedFile!=='undefined'?selectedFile:null;if(!file)return showErrorInModal('docModal','Sélectionne la carte grise');try{const lienDrive=await uploadFileToGoogleDrive(file);await postAppsScriptJson({action:'createDocument',immatriculation:im,categorie:'Carte grise',nom:'Carte grise - '+im,date:'',description:'Carte grise du véhicule',lienDrive});await loadData();closeDocModal();renderVehicleDetailDocuments();showMsg('Carte grise enregistrée ✅','ok');}catch(e){showMsg('Erreur carte grise : '+(e?.message||e),'err');}};

  function loadMaintenanceCostsModule(){const old=document.querySelector('script[data-autoab-maintenance-costs]');if(old)old.remove();const script=document.createElement('script');script.src='entretien-couts.js?v=884';script.async=false;script.dataset.autoabMaintenanceCosts='1';script.onload=installMaintenanceSaveFix;document.body.appendChild(script);}

  function fileToBase64Local(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('Lecture du fichier impossible'));r.onload=()=>{const b64=String(r.result||'').split(',').pop();if(!b64||b64.length<20)return reject(new Error('Lecture du fichier incomplète'));resolve(b64);};r.readAsDataURL(file);});}

  function installMaintenanceSaveFix(){
    window.saveMaintenanceInvoice=async function(){
      const im=activeVehicle(),get=id=>document.getElementById(id),n=id=>Number(get(id)?.value||0);
      const date=get('costDate')?.value||'',totalHT=n('costTotalHT'),revision=n('costRevision'),reparations=n('costRepairs'),pneus=n('costTyres'),autres=n('costOther'),file=get('costFile')?.files?.[0]||null;
      if(!date)return showMsg('La date est obligatoire','err');
      if(!(totalHT>0))return showMsg('Le montant HT doit être supérieur à 0','err');
      if(Math.abs((revision+reparations+pneus+autres)-totalHT)>.01)return showMsg('La ventilation doit correspondre au total HT','err');
      const supplier=String(get('costSupplier')?.value||'').trim(),km=Number(get('costKm')?.value)||'';
      const payload={date,totalHT,supplier,km,revision,reparations,pneus,autres,tyrePosition:pneus>0?(get('costTyrePosition')?.value||''):'',tyreKm:pneus>0?(Number(get('costTyreKm')?.value)||''):''};
      const title=`Entretien ${date}${supplier?' - '+supplier:''}`,description='AUTOAB_COST_V1:'+JSON.stringify(payload),btn=get('costSaveBtn'),state=get('costSaveState');
      if(btn){btn.disabled=true;btn.textContent='Enregistrement…';}if(state)state.textContent=file?'Envoi de la facture et enregistrement…':'Enregistrement de la dépense…';
      try{
        let result,link='';
        if(file){
          const base64=await fileToBase64Local(file);
          const response=await fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'uploadDocument',immatriculation:im,idVehicule:im,categorie:'Entretien coût',nom:title,nomFichier:title,fileName:file.name,mimeType:file.type||'application/octet-stream',fileBase64:base64,date,description})});
          const raw=await response.text();
          try{result=raw?JSON.parse(raw):{};}catch(_){throw new Error('Réponse serveur illisible');}
          if(!response.ok||result?.ok===false||result?.success===false)throw new Error(result?.error||result?.message||'Enregistrement impossible');
          link=result?.url||result?.lienDrive||result?.fileUrl||'';
        }else{
          result=await postAppsScriptJson({action:'createDocument',immatriculation:im,idVehicule:im,categorie:'Entretien coût',nom:title,nomFichier:title,date,description,lienDrive:''});
        }
        const savedId=result?.id||result?.idDocument||result?.documentId||('local-'+Date.now());
        if(!Array.isArray(window.data.documents))window.data.documents=[];
        window.data.documents.push({id:savedId,immatriculation:im,idVehicule:im,categorie:'Entretien coût',nom:title,nomFichier:title,date,description,lienDrive:link,statut:'Actif',dateUpload:new Date().toISOString()});
        if(typeof writeDataCache==='function')writeDataCache(window.data);
        if(typeof closeMaintenanceInvoiceModal==='function')closeMaintenanceInvoiceModal();
        if(typeof renderMaintenanceCostPanel==='function')renderMaintenanceCostPanel();
        if(typeof renderVehicleDetailDocuments==='function')renderVehicleDetailDocuments();
        showMsg('Facture d’entretien enregistrée ✅','ok');
      }catch(e){if(state)state.textContent='Échec : '+(e?.message||e);showMsg('Erreur entretien : '+(e?.message||e),'err');if(btn){btn.disabled=false;btn.textContent='Enregistrer';}}
    };
  }

  function forceDisplayedVersion(){const badge=document.getElementById('appVersionBadge');if(badge)badge.textContent='v8.86';document.documentElement.dataset.appVersion='8.86';}
  injectStyles();loadMaintenanceCostsModule();forceDisplayedVersion();document.addEventListener('DOMContentLoaded',forceDisplayedVersion);setTimeout(forceDisplayedVersion,0);setTimeout(forceDisplayedVersion,500);
})();