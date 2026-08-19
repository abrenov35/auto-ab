/* AUTO-AB v8.79 — Coûts entretien HT, ventilation, pneus, historique annuel illimité */
(function () {
  'use strict';

  const CATEGORY = 'Entretien coût';
  const PAYLOAD_PREFIX = 'AUTOAB_COST_V1:';
  let pendingInvoice = null;
  let currentYearFilter = null;

  const euro = value => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
  const normalize = value => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const round2 = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  const activeVehicle = () => String(
    (typeof vehicleDetailImmat !== 'undefined' && vehicleDetailImmat) ||
    (typeof selectedVehicule !== 'undefined' && selectedVehicule) ||
    localStorage.getItem('activeVehicleAB') || ''
  ).trim();

  function parseCostDocument(doc) {
    const category = normalize(doc?.categorie || doc?.type || '');
    if (!category.includes('entretien cout')) return null;
    const raw = String(doc?.description || '');
    if (!raw.startsWith(PAYLOAD_PREFIX)) return null;
    try {
      const payload = JSON.parse(raw.slice(PAYLOAD_PREFIX.length));
      return {
        ...payload,
        id: doc.id ?? doc.idDocument ?? '',
        lienDrive: doc.lienDrive || doc.lien || '',
        nomDocument: doc.nom || doc.nomFichier || '',
        immatriculation: doc.immatriculation || doc.idVehicule || ''
      };
    } catch (error) {
      console.warn('Entretien coût illisible', error);
      return null;
    }
  }

  function getRecords() {
    const immat = activeVehicle();
    return (Array.isArray(window.data?.documents) ? window.data.documents : [])
      .map(parseCostDocument)
      .filter(Boolean)
      .filter(item => String(item.immatriculation || immat) === immat)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function yearsFromRecords(records) {
    return [...new Set(records.map(r => String(r.date || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)))]
      .sort((a, b) => Number(b) - Number(a));
  }

  function totals(records) {
    return records.reduce((acc, item) => {
      acc.revision += Number(item.revision || 0);
      acc.reparations += Number(item.reparations || 0);
      acc.pneus += Number(item.pneus || 0);
      acc.autres += Number(item.autres || 0);
      acc.total += Number(item.totalHT || 0);
      return acc;
    }, { revision: 0, reparations: 0, pneus: 0, autres: 0, total: 0 });
  }

  function injectStyles() {
    if (document.getElementById('entretienCoutsStyles')) return;
    const style = document.createElement('style');
    style.id = 'entretienCoutsStyles';
    style.textContent = `
      .vehicle-cost-panel{background:#fff;border:1px solid #dfe6ef;border-radius:10px;margin:0 0 12px;box-shadow:0 4px 14px rgba(15,43,73,.055);overflow:hidden;}
      .vehicle-cost-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 13px;border-bottom:1px solid #edf0f4;}
      .vehicle-cost-title{font-size:14px;font-weight:800;color:#0d3a66;display:flex;align-items:center;gap:7px;}
      .vehicle-cost-add{height:32px;padding:0 11px;border:1px solid #185fa5;border-radius:7px;background:#185fa5;color:#fff;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
      .vehicle-cost-years{display:flex;gap:6px;padding:9px 12px 0;overflow-x:auto;}
      .vehicle-cost-year{border:1px solid #cfd8e5;background:#fff;color:#475467;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;}
      .vehicle-cost-year.active{background:#eaf2ff;border-color:#185fa5;color:#185fa5;}
      .vehicle-cost-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:10px 12px 12px;}
      .vehicle-cost-metric{background:#f8fafc;border:1px solid #e5eaf0;border-radius:8px;padding:9px 10px;min-width:0;}
      .vehicle-cost-label{display:block;font-size:9px;font-weight:800;text-transform:uppercase;color:#667085;margin-bottom:3px;}
      .vehicle-cost-value{font-size:14px;font-weight:800;color:#1f2937;white-space:nowrap;}
      .vehicle-cost-metric.total{border-color:#b8cce5;background:#f4f8fd;}.vehicle-cost-metric.total .vehicle-cost-value{color:#0d5aa8;}
      .vehicle-cost-history{padding:0 12px 12px;}
      .vehicle-cost-history summary{cursor:pointer;color:#667085;font-size:11px;font-weight:700;}
      .vehicle-cost-table{width:100%;border-collapse:collapse;margin-top:8px;}.vehicle-cost-table th,.vehicle-cost-table td{padding:7px 8px;border-bottom:1px solid #edf0f4;font-size:11px;text-align:left;}.vehicle-cost-table th{color:#667085;text-transform:uppercase;font-size:9px;}
      .tyre-note{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:999px;background:#f4f8fd;color:#185fa5;font-size:10px;font-weight:700;}
      .cost-modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cost-modal-grid .full{grid-column:1/-1}.cost-summary-line{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:8px;background:#f8fafc;border:1px solid #e5eaf0;font-size:12px;font-weight:700;margin-top:10px}.cost-summary-line.ok{background:#f1f8f3;border-color:#b7d8bf;color:#1f6b38}.cost-summary-line.bad{background:#fff5f5;border-color:#efb6b6;color:#b42318}
      @media(max-width:760px){.vehicle-cost-metrics{grid-template-columns:repeat(2,minmax(0,1fr));}.vehicle-cost-metric.total{grid-column:1/-1}.cost-modal-grid{grid-template-columns:1fr}.cost-modal-grid .full{grid-column:auto}.vehicle-cost-table{min-width:720px}.vehicle-cost-history{overflow-x:auto}}
    `;
    document.head.appendChild(style);
  }

  function ensureModals() {
    if (!document.getElementById('maintenanceInvoiceModal')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div class="modal" id="maintenanceInvoiceModal">
          <div class="modal-content" style="max-width:620px;">
            <div class="modal-header">Ajouter une facture d’entretien</div>
            <div class="cost-modal-grid">
              <div class="form-group"><label>Date *</label><input type="date" id="costDate"></div>
              <div class="form-group"><label>Montant total HT *</label><input type="number" id="costTotalHT" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div>
              <div class="form-group"><label>Garage / fournisseur</label><input type="text" id="costSupplier" maxlength="120" placeholder="Ex. Renault, Norauto…"></div>
              <div class="form-group"><label>Kilométrage</label><input type="number" id="costKm" min="0" step="1" inputmode="numeric" placeholder="Ex. 183450"></div>
              <div class="form-group full"><label>Facture / justificatif</label><input type="file" id="costFile" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><div style="font-size:11px;color:#667085;margin-top:5px;">PDF, JPG ou PNG. Facultatif pour une saisie historique.</div></div>
            </div>
            <div class="form-actions"><button class="btn btn-secondary" onclick="closeMaintenanceInvoiceModal()">Annuler</button><button class="btn btn-success" onclick="openMaintenanceVentilation()">Suivant — Ventiler</button></div>
          </div>
        </div>
        <div class="modal" id="maintenanceVentilationModal">
          <div class="modal-content" style="max-width:620px;">
            <div class="modal-header">Ventilation de la facture HT</div>
            <div class="cost-modal-grid">
              <div class="form-group"><label>Révision / entretien courant</label><input type="number" id="costRevision" min="0" step="0.01" inputmode="decimal" value="0" oninput="updateMaintenanceVentilationTotal()"></div>
              <div class="form-group"><label>Réparations</label><input type="number" id="costRepairs" min="0" step="0.01" inputmode="decimal" value="0" oninput="updateMaintenanceVentilationTotal()"></div>
              <div class="form-group"><label>Pneus</label><input type="number" id="costTyres" min="0" step="0.01" inputmode="decimal" value="0" oninput="updateMaintenanceVentilationTotal()"></div>
              <div class="form-group"><label>Autres</label><input type="number" id="costOther" min="0" step="0.01" inputmode="decimal" value="0" oninput="updateMaintenanceVentilationTotal()"></div>
              <div class="form-group"><label>Pneus — train concerné</label><select id="costTyrePosition"><option value="">—</option><option value="Avant">Avant</option><option value="Arrière">Arrière</option><option value="4 pneus">4 pneus</option></select></div>
              <div class="form-group"><label>Pneus — km au montage</label><input type="number" id="costTyreKm" min="0" step="1" inputmode="numeric" placeholder="Facultatif"></div>
            </div>
            <button type="button" class="btn" style="margin-top:4px;background:#eef5ff;color:#185fa5;border:1px solid #9eb9da;" onclick="maintenanceAllRevision()">Tout en révision</button>
            <div id="costVentilationSummary" class="cost-summary-line"><span>Ventilé : 0,00 € HT</span><span>Facture : 0,00 € HT</span></div>
            <div class="form-actions"><button class="btn btn-secondary" onclick="backToMaintenanceInvoice()">Retour</button><button id="costSaveBtn" class="btn btn-success" onclick="saveMaintenanceInvoice()" disabled>Enregistrer</button></div>
          </div>
        </div>`;
      document.body.append(...wrapper.children);
    }
  }

  window.openMaintenanceInvoiceModal = function () {
    const immat = activeVehicle();
    if (!immat) return showMsg('Aucun véhicule sélectionné', 'err');
    ensureModals();
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('costDate').value = today;
    document.getElementById('costTotalHT').value = '';
    document.getElementById('costSupplier').value = '';
    const vehicle = (Array.isArray(data?.vehicules) ? data.vehicules : []).find(v => v.immatriculation === immat);
    document.getElementById('costKm').value = vehicle?.kilometrage ?? vehicle?.km ?? '';
    document.getElementById('costFile').value = '';
    document.getElementById('maintenanceInvoiceModal').classList.add('active');
  };

  window.closeMaintenanceInvoiceModal = function () { document.getElementById('maintenanceInvoiceModal')?.classList.remove('active'); };
  window.openMaintenanceVentilation = function () {
    const date = document.getElementById('costDate')?.value;
    const totalHT = round2(document.getElementById('costTotalHT')?.value);
    if (!date) return showErrorInModal('maintenanceInvoiceModal', 'La date est obligatoire');
    if (!(totalHT > 0)) return showErrorInModal('maintenanceInvoiceModal', 'Le montant total HT doit être supérieur à 0');
    pendingInvoice = {
      date,
      totalHT,
      supplier: String(document.getElementById('costSupplier')?.value || '').trim(),
      km: Number(document.getElementById('costKm')?.value || 0) || '',
      file: document.getElementById('costFile')?.files?.[0] || null
    };
    ['costRevision','costRepairs','costTyres','costOther'].forEach(id => document.getElementById(id).value = '0');
    document.getElementById('costTyrePosition').value = '';
    document.getElementById('costTyreKm').value = pendingInvoice.km || '';
    document.getElementById('maintenanceInvoiceModal').classList.remove('active');
    document.getElementById('maintenanceVentilationModal').classList.add('active');
    updateMaintenanceVentilationTotal();
  };
  window.backToMaintenanceInvoice = function () {
    document.getElementById('maintenanceVentilationModal')?.classList.remove('active');
    document.getElementById('maintenanceInvoiceModal')?.classList.add('active');
  };
  window.maintenanceAllRevision = function () {
    if (!pendingInvoice) return;
    document.getElementById('costRevision').value = pendingInvoice.totalHT.toFixed(2);
    document.getElementById('costRepairs').value = '0';
    document.getElementById('costTyres').value = '0';
    document.getElementById('costOther').value = '0';
    updateMaintenanceVentilationTotal();
  };
  window.updateMaintenanceVentilationTotal = function () {
    if (!pendingInvoice) return;
    const values = ['costRevision','costRepairs','costTyres','costOther'].map(id => round2(document.getElementById(id)?.value));
    const ventilated = round2(values.reduce((a,b) => a+b, 0));
    const ok = Math.abs(ventilated - pendingInvoice.totalHT) < 0.01;
    const line = document.getElementById('costVentilationSummary');
    if (line) {
      line.className = 'cost-summary-line ' + (ok ? 'ok' : 'bad');
      line.innerHTML = `<span>Ventilé : ${euro(ventilated)} HT</span><span>Facture : ${euro(pendingInvoice.totalHT)} HT</span>`;
    }
    const save = document.getElementById('costSaveBtn');
    if (save) save.disabled = !ok;
  };

  window.saveMaintenanceInvoice = async function () {
    if (!pendingInvoice) return;
    const immat = activeVehicle();
    const revision = round2(document.getElementById('costRevision')?.value);
    const reparations = round2(document.getElementById('costRepairs')?.value);
    const pneus = round2(document.getElementById('costTyres')?.value);
    const autres = round2(document.getElementById('costOther')?.value);
    const sum = round2(revision + reparations + pneus + autres);
    if (Math.abs(sum - pendingInvoice.totalHT) >= 0.01) return showErrorInModal('maintenanceVentilationModal', 'La ventilation doit correspondre exactement au total HT');

    const payloadData = {
      date: pendingInvoice.date,
      totalHT: pendingInvoice.totalHT,
      supplier: pendingInvoice.supplier,
      km: pendingInvoice.km,
      revision,
      reparations,
      pneus,
      autres,
      tyrePosition: pneus > 0 ? String(document.getElementById('costTyrePosition')?.value || '') : '',
      tyreKm: pneus > 0 ? (Number(document.getElementById('costTyreKm')?.value || 0) || '') : ''
    };

    const btn = document.getElementById('costSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
    try {
      let link = '';
      if (pendingInvoice.file) link = await uploadFileToGoogleDrive(pendingInvoice.file);
      const title = `Entretien ${pendingInvoice.date}${pendingInvoice.supplier ? ' - ' + pendingInvoice.supplier : ''}`;
      const result = await postAppsScriptJson({
        action: 'createDocument',
        immatriculation: immat,
        idVehicule: immat,
        categorie: CATEGORY,
        nom: title,
        nomFichier: title,
        date: pendingInvoice.date,
        description: PAYLOAD_PREFIX + JSON.stringify(payloadData),
        lienDrive: link
      });
      if (!Array.isArray(window.data.documents)) window.data.documents = [];
      window.data.documents.push({
        id: result.id || result.idDocument || ('local-' + Date.now()),
        immatriculation: immat,
        idVehicule: immat,
        categorie: CATEGORY,
        nom: title,
        nomFichier: title,
        date: pendingInvoice.date,
        description: PAYLOAD_PREFIX + JSON.stringify(payloadData),
        lienDrive: link,
        statut: 'Actif'
      });
      if (typeof writeDataCache === 'function') writeDataCache(window.data);
      document.getElementById('maintenanceVentilationModal').classList.remove('active');
      pendingInvoice = null;
      renderMaintenanceCostPanel();
      if (typeof renderVehicleDetailDocuments === 'function') renderVehicleDetailDocuments();
      showMsg('Facture d’entretien enregistrée ✅', 'ok');
    } catch (error) {
      showMsg('Erreur entretien : ' + (error?.message || String(error)), 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
      if (typeof hideLoadingOverlay === 'function') hideLoadingOverlay(true);
    }
  };

  function historyRows(records) {
    if (!records.length) return '<div style="font-size:11px;color:#98a2b3;padding:8px 0;">Aucune dépense sur cette période.</div>';
    return `<table class="vehicle-cost-table"><thead><tr><th>Date</th><th>Garage</th><th>Km</th><th>Révision</th><th>Réparations</th><th>Pneus</th><th>Autres</th><th>Total HT</th><th>Facture</th></tr></thead><tbody>${records.map(r => `<tr><td>${formatFrDate(r.date)}</td><td>${safeText(r.supplier || '—')}</td><td>${r.km ? Number(r.km).toLocaleString('fr-FR') : '—'}</td><td>${euro(r.revision)}</td><td>${euro(r.reparations)}</td><td>${euro(r.pneus)}${r.tyrePosition ? `<br><span class="tyre-note">${safeText(r.tyrePosition)}</span>` : ''}</td><td>${euro(r.autres)}</td><td><strong>${euro(r.totalHT)}</strong></td><td>${r.lienDrive ? `<button class="ab-icon-btn view" title="Voir la facture" onclick='viewDocument(${JSON.stringify(r.nomDocument || 'Facture entretien')},${JSON.stringify(r.lienDrive)})'><i class="bi bi-eye"></i></button>` : '—'}</td></tr>`).join('')}</tbody></table>`;
  }

  window.setMaintenanceCostPeriod = function (period) {
    currentYearFilter = period === 'cumul' ? 'cumul' : String(period);
    renderMaintenanceCostPanel();
  };

  window.renderMaintenanceCostPanel = function () {
    const page = document.getElementById('vehicleDetailPage');
    const hero = document.getElementById('vehicleDetailHero');
    if (!page || !hero || page.style.display === 'none') return;
    let panel = document.getElementById('vehicleMaintenanceCostPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'vehicleMaintenanceCostPanel';
      hero.insertAdjacentElement('afterend', panel);
    }
    const records = getRecords();
    const years = yearsFromRecords(records);
    if (!currentYearFilter || (currentYearFilter !== 'cumul' && !years.includes(currentYearFilter))) currentYearFilter = years[0] || String(new Date().getFullYear());
    const selectedRecords = currentYearFilter === 'cumul' ? records : records.filter(r => String(r.date || '').startsWith(currentYearFilter));
    const t = totals(selectedRecords);
    const yearButtons = [...years.map(y => `<button class="vehicle-cost-year ${currentYearFilter===y?'active':''}" onclick="setMaintenanceCostPeriod('${y}')">${y}</button>`), `<button class="vehicle-cost-year ${currentYearFilter==='cumul'?'active':''}" onclick="setMaintenanceCostPeriod('cumul')">Cumul</button>`].join('');
    panel.innerHTML = `<div class="vehicle-cost-panel"><div class="vehicle-cost-head"><div class="vehicle-cost-title"><i class="bi bi-cash-stack"></i> Coûts entretien HT</div><button class="vehicle-cost-add" onclick="openMaintenanceInvoiceModal()"><i class="bi bi-plus-lg"></i> Facture</button></div><div class="vehicle-cost-years">${yearButtons}</div><div class="vehicle-cost-metrics"><div class="vehicle-cost-metric"><span class="vehicle-cost-label">Révisions</span><span class="vehicle-cost-value">${euro(t.revision)}</span></div><div class="vehicle-cost-metric"><span class="vehicle-cost-label">Réparations</span><span class="vehicle-cost-value">${euro(t.reparations)}</span></div><div class="vehicle-cost-metric"><span class="vehicle-cost-label">Pneus</span><span class="vehicle-cost-value">${euro(t.pneus)}</span></div><div class="vehicle-cost-metric"><span class="vehicle-cost-label">Autres</span><span class="vehicle-cost-value">${euro(t.autres)}</span></div><div class="vehicle-cost-metric total"><span class="vehicle-cost-label">Total HT</span><span class="vehicle-cost-value">${euro(t.total)}</span></div></div><div class="vehicle-cost-history"><details><summary>Historique ${currentYearFilter === 'cumul' ? 'complet' : currentYearFilter} — ${selectedRecords.length} facture${selectedRecords.length>1?'s':''}</summary>${historyRows(selectedRecords)}</details></div></div>`;
  };

  function patchVehicleDetailRender() {
    if (typeof window.renderVehicleDetailPage !== 'function' || window.renderVehicleDetailPage.__costPatched) return;
    const original = window.renderVehicleDetailPage;
    const wrapped = function () {
      const result = original.apply(this, arguments);
      renderMaintenanceCostPanel();
      return result;
    };
    wrapped.__costPatched = true;
    window.renderVehicleDetailPage = wrapped;
  }

  injectStyles();
  ensureModals();
  patchVehicleDetailRender();
  setTimeout(() => { patchVehicleDetailRender(); renderMaintenanceCostPanel(); }, 0);
})();
