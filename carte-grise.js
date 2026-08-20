/* AUTO-AB v8.82 — Carte grise dédiée sur la fiche véhicule */
(function () {
  'use strict';

  let currentCarteGrise = null;
  let originalCloseDocModal = null;
  let originalOpenAddDocumentModal = null;

  const normalize = value => String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const docId = doc => doc?.id ?? doc?.idDocument ?? '';
  const docName = doc => doc?.nom || doc?.nomFichier || 'Carte grise';
  const docLink = doc => doc?.lienDrive || doc?.lien || doc?.url || '';
  const docCategory = doc => normalize(doc?.categorie || doc?.type || '');
  const docVehicle = doc => String(doc?.immatriculation || doc?.idVehicule || doc?.vehiculeId || doc?.VehiculeID || '').trim();

  function activeVehicle() {
    return String(
      (typeof vehicleDetailImmat !== 'undefined' && vehicleDetailImmat) ||
      (typeof selectedVehicule !== 'undefined' && selectedVehicule) ||
      localStorage.getItem('activeVehicleAB') || ''
    ).trim();
  }

  function findCarteGrise(immat) {
    const docs = Array.isArray(window.data?.documents) ? window.data.documents : [];
    return docs
      .filter(doc =>
        docVehicle(doc) === immat &&
        (doc.statut || 'Actif') !== 'Archivé' &&
        docCategory(doc).includes('carte grise')
      )
      .sort((a, b) => String(b.dateUpload || b.date || '').localeCompare(String(a.dateUpload || a.date || '')))[0] || null;
  }

  function injectStyles() {
    if (document.getElementById('carteGriseStyles')) return;
    const style = document.createElement('style');
    style.id = 'carteGriseStyles';
    style.textContent = `
      .vehicle-registration-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px;padding:11px 13px;margin-bottom:12px;border:1px solid #dfe6ef;border-radius:9px;background:#f8fafc;}
      .vehicle-registration-info{min-width:0;display:flex;align-items:center;gap:12px;}
      .vehicle-registration-icon{width:36px;height:36px;flex:0 0 36px;border:1px solid #c9d7e8;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:#fff;color:#185fa5;font-size:16px;}
      .vehicle-registration-text{min-width:0;}.vehicle-registration-title{font-size:13px;font-weight:800;color:#102a43;line-height:1.25;}
      .vehicle-registration-meta{margin-top:3px;font-size:11px;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .vehicle-registration-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto;}
      .vehicle-registration-btn{min-height:32px;padding:0 10px;border:1px solid #9eb9da;border-radius:7px;background:#fff;color:#185fa5;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;}
      .vehicle-registration-btn:hover{background:#eef5ff;border-color:#6f9ccc;}.vehicle-registration-btn.primary{background:#185fa5;color:#fff;border-color:#185fa5;}.vehicle-registration-btn.primary:hover{background:#0d4f8d;}
      .vehicle-other-documents-title{font-size:11px;font-weight:800;color:#667085;text-transform:uppercase;margin:4px 0 7px;}
      @media(max-width:620px){.vehicle-registration-row{align-items:flex-start;flex-direction:column;}.vehicle-registration-actions{width:100%;}.vehicle-registration-btn{flex:1;}}
    `;
    document.head.appendChild(style);
  }

  function genericDocumentsHtml(docs) {
    if (!docs.length) return '';
    const rows = docs.map(doc => {
      const id = String(docId(doc));
      return `<tr><td><strong>${safeText(doc.nom || doc.nomFichier || 'Sans nom')}</strong></td><td>${safeText(doc.categorie || doc.type || '—')}</td><td>${safeText(doc.description || '—')}</td><td>${formatFrDate(doc.date)}</td><td><div class="vehicle-doc-actions"><button type="button" class="ab-icon-btn view js-doc-view" data-doc-id="${safeText(id)}" title="Visualiser" aria-label="Visualiser"><i class="bi bi-eye"></i></button><button type="button" class="ab-icon-btn edit js-doc-edit" data-doc-id="${safeText(id)}" title="Modifier" aria-label="Modifier"><i class="bi bi-pencil"></i></button><button type="button" class="ab-icon-btn delete js-doc-delete" data-doc-id="${safeText(id)}" title="Supprimer" aria-label="Supprimer"><i class="bi bi-trash"></i></button></div></td></tr>`;
    }).join('');
    return `<div class="vehicle-other-documents-title">Autres documents</div><table class="vehicle-docs-table"><thead><tr><th>Nom</th><th>Type</th><th>Description</th><th>Date</th><th style="text-align:right">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  window.renderVehicleDetailDocuments = function renderVehicleDetailDocumentsCarteGrise() {
    const box = document.getElementById('vehicleDetailDocuments');
    if (!box) return;
    const immat = activeVehicle();
    const allDocs = (Array.isArray(window.data?.documents) ? window.data.documents : []).filter(doc => docVehicle(doc) === immat && (doc.statut || 'Actif') !== 'Archivé');
    const carteGrise = findCarteGrise(immat);
    const otherDocs = allDocs.filter(doc => doc !== carteGrise && !docCategory(doc).includes('carte grise') && !docCategory(doc).includes('entretien cout'));
    const registrationHtml = carteGrise
      ? `<div class="vehicle-registration-row"><div class="vehicle-registration-info"><span class="vehicle-registration-icon"><i class="bi bi-card-text"></i></span><div class="vehicle-registration-text"><div class="vehicle-registration-title">Carte grise</div><div class="vehicle-registration-meta">${safeText(docName(carteGrise))}${carteGrise.date ? ' · ' + formatFrDate(carteGrise.date) : ''}</div></div></div><div class="vehicle-registration-actions"><button type="button" class="vehicle-registration-btn" onclick="viewCarteGriseFromDetail()"><i class="bi bi-eye"></i> Voir</button><button type="button" class="vehicle-registration-btn" onclick="openCarteGriseFromDetail()"><i class="bi bi-arrow-repeat"></i> Remplacer</button></div></div>`
      : `<div class="vehicle-registration-row"><div class="vehicle-registration-info"><span class="vehicle-registration-icon"><i class="bi bi-card-text"></i></span><div class="vehicle-registration-text"><div class="vehicle-registration-title">Carte grise</div><div class="vehicle-registration-meta">Aucune carte grise enregistrée</div></div></div><div class="vehicle-registration-actions"><button type="button" class="vehicle-registration-btn primary" onclick="openCarteGriseFromDetail()"><i class="bi bi-upload"></i> Ajouter</button></div></div>`;
    box.innerHTML = registrationHtml + genericDocumentsHtml(otherDocs);
  };

  function restoreDocumentModalButton() {
    const submit = document.querySelector('#docModal .form-actions .btn-success');
    if (submit) { submit.onclick = window.submitDocument; submit.innerHTML = '📤 Charger et enregistrer'; }
    currentCarteGrise = null;
  }

  if (typeof window.closeDocModal === 'function') {
    originalCloseDocModal = window.closeDocModal;
    window.closeDocModal = function closeDocModalCarteGrise() { const result = originalCloseDocModal.apply(this, arguments); restoreDocumentModalButton(); return result; };
  }
  if (typeof window.openAddDocumentModal === 'function') {
    originalOpenAddDocumentModal = window.openAddDocumentModal;
    window.openAddDocumentModal = function openAddDocumentModalStandard() { restoreDocumentModalButton(); return originalOpenAddDocumentModal.apply(this, arguments); };
  }

  window.openCarteGriseFromDetail = function openCarteGriseFromDetail() {
    const immat = activeVehicle(); if (!immat) { showMsg('Aucun véhicule sélectionné', 'err'); return; }
    selectedVehicule = immat; currentCarteGrise = findCarteGrise(immat);
    originalOpenAddDocumentModal ? originalOpenAddDocumentModal() : openAddDocumentModal();
    const title=document.getElementById('docModalTitle'),nom=document.getElementById('docNom'),date=document.getElementById('docDate'),description=document.getElementById('docDescription'),link=document.getElementById('docLienDrive'),submit=document.querySelector('#docModal .form-actions .btn-success');
    if (title) title.textContent=currentCarteGrise?'Remplacer la carte grise':'Ajouter la carte grise';
    if (nom) nom.value=currentCarteGrise?docName(currentCarteGrise):`Carte grise - ${immat}`;
    if (date) date.value=String(currentCarteGrise?.date||'').slice(0,10);
    if (description) description.value=currentCarteGrise?.description||'Carte grise du véhicule';
    if (link) link.value=currentCarteGrise?docLink(currentCarteGrise):'';
    if (submit){submit.onclick=window.saveCarteGriseFromDetail;submit.innerHTML=currentCarteGrise?'<i class="bi bi-arrow-repeat"></i> Remplacer':'<i class="bi bi-upload"></i> Ajouter';}
  };

  window.viewCarteGriseFromDetail = function viewCarteGriseFromDetail() {
    const doc=findCarteGrise(activeVehicle()); if(!doc||!docLink(doc)){showMsg('Aucune carte grise disponible','err');return;} viewDocument(docName(doc),docLink(doc),doc.type||doc.categorie||'Carte grise');
  };

  window.saveCarteGriseFromDetail = async function saveCarteGriseFromDetail() {
    if (typeof isSubmitting !== 'undefined' && isSubmitting) return;
    const immat=activeVehicle(),file=typeof selectedFile!=='undefined'?selectedFile:null,existing=currentCarteGrise||findCarteGrise(immat);
    if(!file){showErrorInModal('docModal',existing?'Sélectionne le nouveau fichier de la carte grise':'Sélectionne la carte grise');return;}
    const nom=String(document.getElementById('docNom')?.value||`Carte grise - ${immat}`).trim(),date=String(document.getElementById('docDate')?.value||'').trim(),description=String(document.getElementById('docDescription')?.value||'Carte grise du véhicule').trim();
    try{
      if(typeof isSubmitting!=='undefined')isSubmitting=true;setModalButtonsDisabled('docModal',true);
      const lienDrive=await uploadFileToGoogleDrive(file);
      const payload={action:existing?'updateDocument':'createDocument',immatriculation:immat,idVehicule:immat,categorie:'Carte grise',nom,nomFichier:nom,date,description,lienDrive};if(existing)payload.id=docId(existing);
      const result=await postAppsScriptJson(payload);
      if(!Array.isArray(window.data.documents))window.data.documents=[];
      if(existing){const idx=window.data.documents.findIndex(doc=>String(docId(doc))===String(docId(existing)));const updated={...existing,...payload,statut:existing.statut||'Actif'};delete updated.action;if(idx>=0)window.data.documents[idx]=updated;}
      else window.data.documents.push({id:result.id||result.idDocument||('local-'+Date.now()),immatriculation:immat,idVehicule:immat,categorie:'Carte grise',nom,nomFichier:nom,date,description,lienDrive,statut:'Actif',dateUpload:new Date().toISOString()});
      if(typeof writeDataCache==='function')writeDataCache(window.data);originalCloseDocModal?originalCloseDocModal(true):closeDocModal();restoreDocumentModalButton();window.renderVehicleDetailDocuments();showMsg(existing?'Carte grise remplacée ✅':'Carte grise ajoutée ✅','ok');
    }catch(error){console.error('Carte grise :',error);showMsg('Erreur carte grise : '+(error?.message||String(error)),'err');}
    finally{if(typeof isSubmitting!=='undefined')isSubmitting=false;setModalButtonsDisabled('docModal',false);if(typeof hideLoadingOverlay==='function')hideLoadingOverlay(true);}
  };

  function loadMaintenanceCostsModule() {
    if (document.querySelector('script[data-autoab-maintenance-costs]')) return;
    const script = document.createElement('script');
    script.src = 'entretien-couts.js?v=882';
    script.async = false;
    script.dataset.autoabMaintenanceCosts = '1';
    document.body.appendChild(script);
  }

  function forceDisplayedVersion() {
    const badge = document.getElementById('appVersionBadge');
    if (badge) badge.textContent = 'v8.82';
    document.documentElement.dataset.appVersion = '8.82';
  }

  injectStyles();
  loadMaintenanceCostsModule();
  forceDisplayedVersion();
  document.addEventListener('DOMContentLoaded', forceDisplayedVersion);
  setTimeout(forceDisplayedVersion, 0);
  setTimeout(forceDisplayedVersion, 500);
})();