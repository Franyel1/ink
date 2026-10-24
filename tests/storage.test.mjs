import {test} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {IDBObjectStore} from 'fake-indexeddb';
import {DRAFTS,idbPut,idbGet,idbGetAll,idbReplace} from '../src/lib/idb.ts';

test('a committed draft round-trips text, identity, and image blobs',async()=>{
  await idbPut(DRAFTS,{id:'original',userId:'alice',content:'Kept offline',files:[new Blob(['image bytes'],{type:'image/png'})]});
  const row=await idbGet(DRAFTS,'original');
  assert.equal(row.userId,'alice');assert.equal(row.content,'Kept offline');
  assert.equal(await row.files[0].text(),'image bytes');
});
test('a request succeeding before its transaction aborts is not acknowledged as saved',async()=>{
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){
    const request=put.apply(this,args);
    request.addEventListener('success',()=>this.transaction.abort());
    return request;
  };
  try{await assert.rejects(idbPut(DRAFTS,{id:'aborted',content:'must not be acknowledged'}));}
  finally{IDBObjectStore.prototype.put=put;}
  assert.equal(await idbGet(DRAFTS,'aborted'),undefined);
});
test('conflict resolution replaces the old operation in a single committed transaction',async()=>{
  await idbReplace(DRAFTS,'original',{id:'resolved',userId:'alice',content:'Merged version'});
  assert.equal(await idbGet(DRAFTS,'original'),undefined);
  assert.equal((await idbGet(DRAFTS,'resolved')).content,'Merged version');
  assert.equal((await idbGetAll(DRAFTS)).length,1);
});
test('an interrupted conflict resolution preserves the original operation',async()=>{
  const remove=IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete=function(...args){
    const request=remove.apply(this,args);
    request.addEventListener('success',()=>this.transaction.abort());return request;
  };
  try{await assert.rejects(idbReplace(DRAFTS,'resolved',{id:'failed-replacement',content:'new'}));}
  finally{IDBObjectStore.prototype.delete=remove;}
  assert.equal(await idbGet(DRAFTS,'failed-replacement'),undefined);
  assert.equal((await idbGet(DRAFTS,'resolved')).content,'Merged version');
});
