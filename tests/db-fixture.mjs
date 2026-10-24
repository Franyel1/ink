import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

/** Real project tables/RLS and migration, with auth.uid supplied by a test JWT setting. */
export async function notebookDatabase(){
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  const schema=await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');
  const start=schema.indexOf('create table if not exists public.profiles');
  const end=schema.indexOf('create index if not exists posts_user_created_idx');
  if(start<0||end<start)throw Error('Schema fixture boundaries changed');
  // Optional vector operations and Storage HTTP endpoints are not emulated.
  await db.exec(schema.slice(start,end).replaceAll('vector(1536)','text'));
  await db.exec(schema.slice(schema.indexOf('alter table public.profiles enable row level security'),schema.indexOf('-- ========== Auto-create')));
  await db.exec('grant usage on schema public to authenticated,anon; grant select,insert,update,delete on all tables in schema public to authenticated');
  await db.exec(await readFile(new URL('../supabase/migrations/013_notebook_depth.sql',import.meta.url),'utf8'));
  return db;
}
