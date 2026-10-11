const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../expenses-allocation'),R=require('../expenses-core');
const line={category:'parking',month:'2026-09',scope:'unassigned',plate:'',personId:'',maintenanceId:'',litres:null,amounts:{ht:30000,vat:6000,ttc:36000}};
test('Partial assignment keeps totals and moves only the selected HT into driver KPI',()=>{
 const lines=A.split(line,10000,'p1','driver');
 const invoice=R.validate({supplier:'other',account:'Parking',number:'1',date:'2026-09-30',period:'2026-09',totals:line.amounts,lines});
 assert.equal(R.summary(R.select([invoice],{month:'2026-09',personId:'p1'}),'ht').total,10000);
 assert.equal(R.summary(R.select([invoice],{month:'2026-09',unassigned:true}),'ht').total,20000);
 assert.equal(R.summary(R.select([invoice],{month:'2026-09'}),'ht').total,30000);
 assert.deepEqual(line.amounts,{ht:30000,vat:6000,ttc:36000});
});
test('One-cent rounding and full assignment preserve HT VAT and TTC',()=>{
 const l={...line,amounts:{ht:101,vat:20,ttc:121}}; const out=A.split(l,50,'p1','driver');
 for(const k of ['ht','vat','ttc'])assert.equal(out.reduce((sum,x)=>sum+x.amounts[k],0),l.amounts[k]);
 out.forEach(x=>assert.equal(x.amounts.ht+x.amounts.vat,x.amounts.ttc));
 assert.equal(A.split(l,101,'AA123AA','vehicle').length,1);
});
test('Unknown VAT stays unknown, and invalid allocations cannot be saved',()=>{
 assert.equal(A.split({...line,amounts:{ht:30000,vat:null,ttc:null}},1,'p1','driver')[0].amounts.vat,null);
 for(const n of [0,-1,30001,null])assert.throws(()=>A.split(line,n,'p1','driver'));
 assert.throws(()=>A.split(line,100,'','driver'));
});
