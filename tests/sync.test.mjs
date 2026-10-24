import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drainQueue} from '../src/lib/sync-core.ts';

const draft=(id,postId=id,userId='alice',state='pending')=>({id,postId,userId,state,createdAt:`2026-01-01T00:00:0${id}Z`});
test('a request accepted by the server but lost on the network remains recoverable',async()=>{
  const queue=[draft('1')],receipts=new Set();let attempt=0;
  const send=async d=>{receipts.add(d.id);if(attempt++===0)throw Error('connection lost after commit');return d.postId;};
  const remove=async()=>queue.splice(0,1);const fail=async()=>{};
  assert.deepEqual(await drainQueue({userId:'alice',drafts:queue,send,remove,fail}),[]);
  assert.equal(queue.length,1);
  assert.deepEqual(await drainQueue({userId:'alice',drafts:queue,send,remove,fail}),['1']);
  assert.equal(queue.length,0);assert.equal(receipts.size,1);
});
test('conflicts block dependent edits but do not starve unrelated entries',async()=>{
  const sent=[];
  await drainQueue({userId:'alice',drafts:[draft('1','x','alice','conflict'),draft('2','x'),draft('3','y')],
    send:async d=>sent.push(d.id),remove:async()=>{},fail:async()=>{}});
  assert.deepEqual(sent,['3']);
});
test('account switching and unowned legacy drafts never flush into the current account',async()=>{
  const sent=[];
  await drainQueue({userId:'alice',drafts:[draft('1','x','bob'),draft('2','y',''),draft('3')],
    send:async d=>sent.push(d.id),remove:async()=>{},fail:async()=>{}});
  assert.deepEqual(sent,['3']);
});
test('a local delete failure after server success leaves the operation retryable',async()=>{
  const failed=[];
  const results=await drainQueue({userId:'alice',drafts:[draft('1')],send:async()=> 'saved',
    remove:async()=>{throw Error('disk unavailable');},fail:async d=>failed.push(d.id)});
  assert.deepEqual(results,[]);assert.deepEqual(failed,['1']);
});
