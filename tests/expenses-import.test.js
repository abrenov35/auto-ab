'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../expenses-import'),R=require('../expenses-core');
// Fictional fixtures only. Never commit a customer invoice or OCR output.
const fuel=()=>[`Intermarche
Votre no de client 10000
Numero de facture 900001
Date de la facture 30/09/2026
0000001 15/09/2026 08:00 00001-TEST 1234 10000 B7 GAZOLE 10.00 1.200 20.00 12.00
Sous Total Carte 0000001 (Carburant PRO) 12.00
Sous Total PERSONNE TEST 12.00`,
`Frais de Gestion 2.00 20.00 2.40
B7 gazole 20.00 10.00 10.00 2.00 12.00
Total 12.00 2.40 14.40`];
const park=()=>[`EasyPark
Date: 31.08.2026
Reference facture: 900002
Periode: 01.08.2026 - 31.08.2026
Numero client: 10001
Personne Test, +33000000001
1. Debut : 05.08.2026 08:57 Ville 3,20 EUR 0% 0,00 EUR 3,20
Fin: 06.08.2026 08:57
Plaque d'immatriculation: Code de zone: 100000
AA123AA
Adresse Numero de TVA Contact
Pied de page sans rapport`,
`By Arrive
Transaction ID: 1-FR-10000- Nom de zone: TEST
111111 Rouge
Montant des stationnements: 3,20 EUR 0,00 EUR 3,20
2. Transaction ID: 0-FR-EP- Frais mensuels 5,99 EUR 20% 1,20 EUR 719
10000001 Premium 01.09.2026 - 30.09.2026
3. Transaction ID: 0-FR-EP-10000002 Remise Frais mensuels 01.09.2026 - -2,00 EUR 20% = -0,40 EUR -2,40
30.09.2026
Montant service EasyPark: 3,99 EUR 0,80 EUR 479
Total Personne Test, +33000000001: 7,19 EUR 0,80 EUR 7,99
Correction
Ajustement du a l'arrondissement Montant (HT): 0,02 EUR -0,01
TVA: -0,03 EUR`];
test('Fuel extracts dated card, explicit rate, litres and separate common fees',()=>{const p=P.parse('intermarche',fuel());assert.equal(p.balanced,true);assert.equal(p.invoice.lines.length,2);assert.equal(p.invoice.totals.ht,1200);assert.equal(p.invoice.lines[0].amounts.ht,1000);assert.equal(p.invoice.lines[0].amountOrigin,'calculated_from_printed_rate');assert.equal(p.invoice.lines[0].litres,10);assert.equal(p.invoice.lines[0].plate,'');assert.equal(p.invoice.lines[1].scope,'common');R.validate(p.invoice);});
test('Unknown fuel format or missing detail cannot appear balanced',()=>{const p=P.parse('intermarche',fuel().map(s=>s.replace('B7 GAZOLE','PRODUIT INCONNU')));assert.equal(p.balanced,false);assert.ok(p.warnings.some(w=>w.includes('non reconnue')));});
test('No fuel rate guessing: differing explicit rate changes derived HT',()=>{const f=fuel();f[0]=f[0].replace('20.00 12.00','10.00 12.00');const p=P.parse('intermarche',f);assert.equal(p.invoice.lines[0].amounts.ht,1091);assert.equal(p.balanced,false);});
test('A summary mismatch is explicit, not an invented rounding adjustment',()=>{const f=fuel();f[1]=f[1].replace('Total 12.00','Total 12.01');const p=P.parse('intermarche',f);assert.equal(p.invoice.lines.length,2);assert.equal(p.balanced,false);assert.ok(p.warnings.some(w=>w.includes('Écart')));});
test('EasyPark handles cross-page transaction and separates invoice month from service period',()=>{const p=P.parse('easypark',park());assert.equal(p.balanced,true);assert.equal(p.invoice.lines.length,4);assert.equal(p.invoice.lines[0].transactionId,'1-FR-10000-111111');assert.equal(p.invoice.lines[0].sourcePlate,'AA123AA');assert.equal(p.invoice.lines[1].transactionId,'0-FR-EP-10000001');assert.equal(p.invoice.lines[1].month,'2026-09');assert.equal(p.invoice.period,'2026-08');assert.equal(p.invoice.lines[2].amounts.ht,-200);assert.equal(p.invoice.totals.ht,721);R.validate(p.invoice);});
test('EasyPark retains explicit adjustment only and flags total as reconstructed',()=>{const p=P.parse('easypark',park());assert.equal(p.sourceTotal,'printed_subtotals');assert.equal(p.requiresReview,true);assert.equal(p.invoice.lines[3].amounts.ht,2);assert.equal(p.invoice.lines[3].scope,'common');assert.ok(p.warnings.some(w=>w.includes('reconstitué')));});
test('Missing OCR decimal in control amount is not invented',()=>{const p=P.parse('easypark',park());assert.equal(p.invoice.lines[1].amounts.ttc,null);assert.equal(p.invoice.lines[1].amounts.ht,599);});
test('Missing HT stays missing, total mismatch prevents validation',()=>{const p=P.parse('easypark',park().map(s=>s.replace('5,99 EUR','illisible EUR')));assert.equal(p.invoice.lines[1].amounts.ht,null);assert.equal(p.balanced,false);assert.throws(()=>R.validate(p.invoice));});
test('Repeated complete transaction IDs produce a review warning, never silent deduplication',()=>{const p=P.parse('easypark',park().map(s=>s.replace('10000002','10000001')));assert.equal(p.invoice.lines.length,4);assert.ok(p.warnings.some(w=>w.includes('répétés')));});
test('Original source identity and periods survive validation, mapping covers entire service period',()=>{const p=P.parse('easypark',park()),i=R.validate(p.invoice),l=i.lines[1];assert.equal(l.sourcePerson,'Personne Test');assert.equal(l.externalId,'+33000000001');assert.equal(l.periodEnd,'2026-09-30');const m={supplier:'easypark',account:'10001',kind:'user',source:l.externalId,from:'2026-09-01',to:'2026-09-15',personId:'person-id'};assert.equal(R.mapped(l,i,[m]).personId,'');m.to='2026-09-30';assert.equal(R.mapped(l,i,[m]).personId,'person-id');});
test('Distinct invoice identities cannot be silently merged by attaching another invoice',()=>{assert.throws(()=>P.parse('easypark',[...park(),'Reference facture: 900099']),/Plusieurs factures/);assert.throws(()=>P.parse('intermarche',[...fuel(),'Numero de facture 900099']),/Plusieurs factures/);});
