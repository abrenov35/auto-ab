'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const R=require('../expenses-core');
test('Documents filter months, group repairs by vehicle, escape names and omit cancelled invoices',async()=>{
 const invoice=(id,category,month,plate,status='active')=>({id,category,status,date:month+'-15',period:month,number:id,account:'Garage',revision:1,documents:[{name:'<'+id+'>.pdf',url:'https://drive.google.com/file/d/'+id+'/view'}],lines:[{category,month,plate,label:'Réparation',personId:'',scope:'assigned',amounts:{ht:1000,vat:null,ttc:null},litres:null}],totals:{ht:1000,vat:null,ttc:null}});
 const snapshot={invoices:[invoice('fuel','fuel','2026-10',''),invoice('old','fuel','2026-09',''),invoice('repair','maintenance','2025-01','AA123AA'),invoice('deleted','maintenance','2026-10','AA123AA','cancelled')],people:[],audit:[],completion:{},mappings:[]};
 const listeners={};let html='';const context={window:{},state:{view:'expenses',token:'x'},ExpenseRules:R,ExpenseReport:require('../expenses-report'),escapeHtml:s=>String(s??'').replace(/</g,'&lt;').replace(/>/g,'&gt;'),todayParis:()=> '2026-10-11',dateView:s=>s,iso:s=>s,list:()=>[{immatriculation:'AA-123-AA',marque:'Renault',modele:'Kangoo'}],archived:()=>false,safeLink:s=>s,title:(a,b,c)=>a+b+c,request:async()=>snapshot,toast:()=>{},document:{addEventListener:(k,f)=>listeners[k]=f},FormData:class{constructor(f){this.f=f}*[Symbol.iterator](){yield*Object.entries(this.f.values)}}};
 context.window.render=()=>{html=context.window.Expenses.render()};vm.createContext(context);vm.runInContext(fs.readFileSync('expenses.js','utf8'),context);await context.window.Expenses.open();
 listeners.click({target:{closest:()=>({dataset:{exp:'documents'}})},preventDefault(){}});
 assert.match(html,/&lt;fuel&gt;.pdf/);assert.doesNotMatch(html,/&lt;old&gt;/);assert.doesNotMatch(html,/<fuel>/);
 listeners.change({target:{closest:s=>s==='#expenseDocumentsFilters'?{}:{values:{category:'maintenance',plate:'',query:''}}}});
 assert.match(html,/Renault · Kangoo · AA-123-AA/);assert.match(html,/&lt;repair&gt;/);assert.doesNotMatch(html,/&lt;deleted&gt;/);assert.match(html,/data-exp="deleteDocument"/);
 const before=R.summary(R.select(snapshot.invoices,{month:'2025-01'}),'ht').total;snapshot.invoices[2].status='cancelled';assert.equal(before,1000);assert.equal(R.summary(R.select(snapshot.invoices,{month:'2025-01'}),'ht').total,0);
});
test('Garage invoice supports original supplier name and exact HT totals',()=>{
 const inv={supplier:'other',account:'Garage Rennes',number:'G1',date:'2026-10-11',period:'2026-10',totals:{ht:1000,vat:null,ttc:null},lines:[{category:'maintenance',date:'2026-10-11',plate:'AA123AA',amounts:{ht:1000,vat:null,ttc:null}}]};assert.equal(R.validate(inv).account,'Garage Rennes');assert.throws(()=>R.validate({...inv,totals:{ht:1100,vat:null,ttc:null}}),/Écart/);
});
