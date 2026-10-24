import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {notebookDatabase} from '../tests/db-fixture.mjs';
import {DEMO_POSTS} from '../src/lib/demo-data.ts';

const db=await notebookDatabase();
try{
  const owner=randomUUID();
  await db.query('insert into auth.users values($1)',[owner]);
  const targets=[];
  for(const post of DEMO_POSTS){
    const id=randomUUID();targets.push({...post,id});
    await db.query('insert into posts(id,user_id,content,post_type,created_at) values($1,$2,$3,$4,$5)',[id,owner,post.content,post.post_type,post.created_at]);
  }
  await db.query(`insert into posts(user_id,content,created_at)
    select $1::uuid, 'Ordinary notebook filler number '||i||'. Walked home after a busy day.',
    '2026-10-01'::timestamptz + i * interval '1 second' from generate_series(1,4982) i`,[owner]);
  await db.exec('analyze posts; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  const cases=[['application',3],['portfolio broken',6],['basil windowsill',4],['floor picnic',1],['six minutes',2],['breakfast hill',11],['questions preparation',17],['container borrowed',13]];
  const samples=[];let hits=0;
  for(const [query,index] of cases){
    const warm=await db.query('select * from search_notebook(query_text=>$1,page_size=>5)',[query]);
    if(warm.rows.some(r=>r.id===targets[index].id))hits++;
    for(let run=0;run<10;run++){
      const start=performance.now();
      await db.query('select * from search_notebook(query_text=>$1,page_size=>5)',[query]);
      samples.push(performance.now()-start);
    }
  }
  samples.sort((a,b)=>a-b);
  const report={
    measuredAt:new Date().toISOString(),runtime:process.version,platform:process.platform,
    database:'PGlite 0.5.8, in-memory PostgreSQL; actual search_notebook SQL and RLS',
    entries:5000,queries:cases.length,runsPerQuery:10,
    expectedEntryInTop5:{hits,total:cases.length},
    medianMs:Number(samples[Math.floor(samples.length/2)].toFixed(2)),
    p95Ms:Number(samples[Math.floor(samples.length*.95)].toFixed(2)),
    limits:'Synthetic single-user keyword queries after warmup. SQL only; excludes network, result hydration, embedding calls, and production concurrency. No production latency or semantic quality claim.',
  };
  await mkdir('docs',{recursive:true});
  await writeFile('docs/search-benchmark.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(hits!==cases.length)process.exitCode=1;
}finally{await db.close();}
