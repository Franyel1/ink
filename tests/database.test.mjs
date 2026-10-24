import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {notebookDatabase} from './db-fixture.mjs';

let db;
const alice=randomUUID(),bob=randomUUID();
let entry,tag,person,activeUser;
const sql=(q,args=[])=>db.query(q,args);
async function asUser(id){
  activeUser=id;
  await db.exec('reset role; set role authenticated');
  await sql("select set_config('request.jwt.claim.sub',$1,false)",[id]);
}
async function save({id=randomUUID(),op=randomUUID(),revision=null,body='A notebook entry',tags=[],images=[],quoted=null,at='2026-02-01T12:00:00Z'}={}){
  return (await sql('select public.save_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result',
    [op,id,revision,body,'thought',tags,images,quoted,at,activeUser])).rows[0].result;
}
before(async()=>{
  db=await notebookDatabase();
  await sql('insert into auth.users values ($1),($2)',[alice,bob]);
  await asUser(alice);
  tag=randomUUID();person=randomUUID();
  await sql('insert into public.tags(id,user_id,name) values($1,$2,$3)',[tag,alice,'Career']);
  await sql('insert into public.people(id,user_id,name) values($1,$2,$3)',[person,alice,'Maya']);
});
after(()=>db.close());

test('a lost create response can be retried without duplicate text, tags, or images',async()=>{
  entry=randomUUID();const op=randomUUID();
  const input={id:entry,op,body:'First interview with Maya. C++ notes.',tags:[tag],images:[`https://example.supabase.co/storage/v1/object/public/post-images/${alice}/${op}/0`]};
  assert.equal((await save(input)).status,'saved');
  assert.equal((await save(input)).status,'saved');
  assert.equal((await sql('select * from posts')).rows.length,1);
  assert.equal((await sql('select * from post_images')).rows.length,1);
  assert.equal((await sql('select * from post_tags')).rows.length,1);
});
test('stale device edits conflict; replaying an accepted edit preserves the newer version',async()=>{
  const op=randomUUID();
  assert.equal((await save({id:entry,op,revision:1,body:'Interview went well',tags:[tag]})).status,'saved');
  assert.equal((await save({id:entry,revision:1,body:'Stale device text'})).status,'conflict');
  assert.equal((await save({id:entry,revision:2,body:'Accepted the offer',tags:[tag]})).status,'saved');
  assert.equal((await save({id:entry,op,revision:1,body:'Interview went well'})).status,'saved');
  assert.equal((await sql('select content,revision from posts where id=$1',[entry])).rows[0].revision,3);
  const versions=(await sql('select * from post_versions order by revision')).rows;
  assert.equal(versions.length,2);assert.equal(versions[0].content,'First interview with Maya. C++ notes.');
  assert.deepEqual(versions[0].tag_ids,[tag]);assert.equal(versions[0].image_urls.length,1);
  assert.equal(versions[1].content,'Interview went well');
});
test('version restoration is a new edit, preserving the replaced words',async()=>{
  await save({id:entry,revision:3,body:'First interview with Maya. C++ notes.',tags:[tag]});
  assert.equal((await sql('select content from post_versions where revision=3')).rows[0].content,'Accepted the offer');
});
test('search finds older entries independently of feed pagination and applies filters before paging',async()=>{
  for(let i=0;i<26;i++)await save({body:`Notebook filler ${i}`,at:'2026-09-01T12:00:00Z'});
  await sql('insert into post_people(post_id,person_id,user_id) values($1,$2,$3)',[entry,person,alice]);
  const result=await sql('select * from search_notebook(query_text=>$1,filter_tag=>$2,filter_person=>$3,date_from=>$4,date_to=>$5)',
    ['C++',tag,person,'2026-02-01','2026-02-02']);
  assert.deepEqual(result.rows.map(r=>r.id),[entry]);
  assert.equal((await sql("select * from search_notebook(query_text=>'Maya interview')")).rows[0].id,entry);
  const first=(await sql('select * from search_notebook(page_size=>20)')).rows;
  const second=(await sql('select * from search_notebook(page_size=>20,page_offset=>20)')).rows;
  assert.equal(first.length,20);assert.equal(second.length,7);
  assert.equal(new Set([...first,...second].map(r=>r.id)).size,27);
});
test('threads are chronological, explainable, bidirectional, and support dismissal/undo',async()=>{
  const older=randomUUID(),unrelated=randomUUID();
  await save({id:older,body:'Thinking about a new career',tags:[tag],at:'2026-01-01'});
  await save({id:unrelated,body:'An unrelated memory',at:'2026-04-01'});
  let rows=(await sql('select * from entry_thread($1)',[entry])).rows;
  assert.equal(rows[0].id,older);assert.ok(rows[0].reasons.includes('Shared tag'));
  await sql('select set_entry_connection($1,$2,$3)',[entry,older,'dismissed']);
  assert.equal((await sql('select * from entry_thread($1)',[entry])).rows.length,0);
  assert.equal((await sql('select * from entry_thread($1,true)',[entry])).rows[0].id,older);
  await sql('select set_entry_connection($1,$2,$3)',[entry,older,null]);
  await sql('select set_entry_connection($1,$2,$3)',[entry,unrelated,'linked']);
  rows=(await sql('select * from entry_thread($1)',[entry])).rows;
  assert.deepEqual(rows.map(r=>r.id),[older,unrelated]);
  assert.ok((await sql('select * from entry_thread($1)',[unrelated])).rows.some(r=>r.id===entry));
});
test('another account cannot read history, search IDs, link entries, or overwrite them',async()=>{
  await asUser(bob);
  assert.equal((await sql('select * from post_versions')).rows.length,0);
  assert.equal((await sql('select * from search_notebook(semantic_ids=>$1)',[[entry]])).rows.length,0);
  assert.equal((await sql('select * from entry_thread($1)',[entry])).rows.length,0);
  await assert.rejects(save({id:entry,revision:4,body:'Stolen'}),/Entry unavailable/);
  const own=randomUUID();await save({id:own});
  await assert.rejects(sql('select set_entry_connection($1,$2,$3)',[own,entry,'linked']),/Entry unavailable/);
  await assert.rejects(save({tags:[tag]}),/Tag unavailable/);
  await assert.rejects(save({quoted:entry}),/Quoted entry unavailable/);
  await assert.rejects(sql('insert into post_versions(post_id,revision,user_id,content,post_type) values($1,99,$2,$3,$4)',[own,bob,'forged','thought']),/permission denied/);
  await asUser(alice);
});
test('deleted entries stay deleted when a lost response is retried',async()=>{
  const id=randomUUID(),op=randomUUID();await save({id,op});
  await sql('delete from posts where id=$1',[id]);
  assert.equal((await save({id,op})).status,'missing');
  assert.equal((await save({id,revision:1})).status,'missing');
  assert.equal((await sql('select * from posts where id=$1',[id])).rows.length,0);
});
test('anonymous callers cannot execute notebook writes or searches',async()=>{
  await db.exec('reset role; set role anon');
  await sql("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(save(),/permission denied/);
  await assert.rejects(sql('select * from search_notebook()'),/permission denied/);
  await asUser(alice);
});

test('switching sessions between queueing and sending cannot write under the new owner',async()=>{
  await asUser(bob);
  await assert.rejects(sql('select save_entry($1,$2,null,$3,$4,expected_user=>$5)',
    [randomUUID(),randomUUID(),'Alice private draft','thought',alice]),/account that wrote this entry/);
  await asUser(alice);
});
test('a failed compound edit is atomic, including version history and tags',async()=>{
  const before=(await sql('select content,revision from posts where id=$1',[entry])).rows[0];
  const count=(await sql('select count(*) from post_versions where post_id=$1',[entry])).rows[0].count;
  await assert.rejects(save({id:entry,revision:before.revision,body:'Should roll back',tags:[randomUUID()]}),/Tag unavailable/);
  assert.deepEqual((await sql('select content,revision from posts where id=$1',[entry])).rows[0],before);
  assert.equal((await sql('select count(*) from post_versions where post_id=$1',[entry])).rows[0].count,count);
  assert.equal((await sql('select tag_id from post_tags where post_id=$1',[entry])).rows[0].tag_id,tag);
});
