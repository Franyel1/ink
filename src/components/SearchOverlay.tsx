"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import type {Post,Tag} from "@/lib/types";
import {POST_TYPES} from "@/lib/types";
import {searchNotebook,SEARCH_PAGE_SIZE,type SearchFilters} from "@/lib/notebook";
import {createClient} from "@/lib/supabase/client";
import {readCachedFeed} from "@/lib/offline";
import type {PostAuthor} from "@/components/PostCard";

interface Props {
  open:boolean; posts:Post[]; tags:Tag[]; author:PostAuthor;
  onClose:()=>void; onEdit:(post:Post)=>void; onDelete:(post:Post)=>void;
  onTogglePin:(post:Post)=>void; onQuote?:(post:Post)=>void;
}
export default function SearchOverlay({open,posts,tags,onClose}:Props) {
  const [filters,setFilters]=useState<SearchFilters>({query:""});
  const [results,setResults]=useState<Post[]>([]);
  const [people,setPeople]=useState<{id:string;name:string}[]>([]);
  const [busy,setBusy]=useState(false);
  const [hasMore,setHasMore]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const run=useRef(0);
  const offset=useRef(0);

  useEffect(()=>{
    if (!open) return;
    let stale=false;
    void createClient().from("people").select("id,name").order("name").then(({data})=>{
      if (!stale) setPeople(data??[]);
    });
    return ()=>{stale=true;};
  },[open]);
  useEffect(()=>{
    const request=++run.current;
    if (!open) return;
    const timer=setTimeout(async ()=>{
      setBusy(true);setError("");setNotice("");setHasMore(false);setResults([]);offset.current=0;
      try {
        const result=await searchNotebook(filters);
        if(request!==run.current)return;
        setResults(result.posts);setHasMore(result.hasMore);offset.current=SEARCH_PAGE_SIZE;
        if(result.meaningUnavailable)setNotice("Meaning search is unavailable. Showing keyword matches.");
      }catch{
        const cache=await readCachedFeed();
        if(request!==run.current)return;
        if(!navigator.onLine){
          const q=filters.query.trim().toLowerCase();
          const start=filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : -Infinity;
          const end=filters.to ? new Date(`${filters.to}T00:00:00`) : null;
          if(end)end.setDate(end.getDate()+1);
          setResults((cache?.posts??posts).filter(p=>(!q||p.content.toLowerCase().includes(q))
            &&(!filters.type||p.post_type===filters.type)
            &&(!filters.tagId||p.post_tags.some(t=>t.tag_id===filters.tagId))
            &&(!filters.personId||p.post_people?.some(t=>t.person_id===filters.personId))
            &&new Date(p.created_at).getTime()>=start&&(!end||new Date(p.created_at)<end)));
          setNotice("Offline. Searching only entries saved on this device.");
        }else setError("Couldn't search your notebook. Please retry.");
      }finally{if(request===run.current)setBusy(false);}
    },250);
    return ()=>{clearTimeout(timer);run.current=request+1;};
  },[open,filters,posts,retry]);
  async function more(){
    const request=run.current;setBusy(true);
    try{
      const result=await searchNotebook(filters,offset.current);
      if(request!==run.current)return;
      setResults(all=>[...all,...result.posts.filter(p=>!all.some(a=>a.id===p.id))]);
      setHasMore(result.hasMore);offset.current+=SEARCH_PAGE_SIZE;
    }catch{if(request===run.current)setError("Couldn't load more. Please retry.");}
    finally{if(request===run.current)setBusy(false);}
  }
  if(!open)return null;
  const change=(key:keyof SearchFilters,value:string|boolean)=>setFilters(f=>({...f,[key]:value}));
  return <section aria-label="Search notebook" className="absolute inset-0 z-40 flex flex-col bg-background">
    <header className="shrink-0 px-5 pb-4 pt-[calc(var(--safe-top)+1rem)]">
      <div className="flex items-center gap-4">
        <input autoFocus aria-label="Search your entire notebook" placeholder="Search your entire notebook…" value={filters.query}
          onChange={e=>change("query",e.target.value)} className="ink-input write-line min-w-0 flex-1 pb-2"/>
        <button onClick={onClose} className="text-sm text-muted">Done</button>
      </div>
      <details className="mt-4 text-sm text-muted">
        <summary className="cursor-pointer">Refine your search</summary>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label>Type<select aria-label="Entry type" value={filters.type??""} onChange={e=>change("type",e.target.value)} className="mt-1 block w-full bg-background py-2">
            <option value="">Any type</option>{POST_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
          <label>Tag<select aria-label="Tag" value={filters.tagId??""} onChange={e=>change("tagId",e.target.value)} className="mt-1 block w-full bg-background py-2">
            <option value="">Any tag</option>{tags.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
          <label>Person<select aria-label="Person" value={filters.personId??""} onChange={e=>change("personId",e.target.value)} className="mt-1 block w-full bg-background py-2">
            <option value="">Anyone</option>{people.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!filters.meaning} onChange={e=>change("meaning",e.target.checked)}/>Include meaning matches</label>
          <label>From<input type="date" value={filters.from??""} onChange={e=>change("from",e.target.value)} className="ink-input mt-2 w-full"/></label>
          <label>Through<input type="date" value={filters.to??""} onChange={e=>change("to",e.target.value)} className="ink-input mt-2 w-full"/></label>
        </div>
        <button onClick={()=>setFilters({query:filters.query})} className="mt-4 underline">Clear filters</button>
      </details>
    </header>
    <div className="scroll-area flex-1 px-5 pb-10" aria-live="polite" aria-busy={busy}>
      {notice&&<p className="mb-4 text-sm text-muted">{notice}</p>}
      {error&&<p role="alert" className="my-4 text-sm">{error} <button className="underline" onClick={()=>setRetry(n=>n+1)}>Retry search</button></p>}
      {results.map(p=><Link key={p.id} href={`/post/${p.id}`} className="block border-b border-border py-5">
        <p className="text-xs text-faint">{new Date(p.created_at).toLocaleDateString()} · {p.post_type}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
        <span className="mt-3 block text-xs text-muted">Open entry & memory thread →</span>
      </Link>)}
      {busy&&<p className="py-8 text-sm text-faint">Searching…</p>}
      {!busy&&!error&&results.length===0&&<p className="py-8 text-sm text-faint">No entries match. Try fewer words or clear a filter.</p>}
      {hasMore&&<button disabled={busy} onClick={()=>void more()} className="mt-6 text-sm underline disabled:opacity-40">Load more matches</button>}
    </div>
  </section>;
}
