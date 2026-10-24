"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {connectEntries,fetchThread,searchNotebook,type ThreadEntry} from "@/lib/notebook";
import type {Post} from "@/lib/types";
import MemoryTimeline from "@/components/MemoryTimeline";

export default function ThreadPanel({post}:{post:Post}) {
  const [entries,setEntries]=useState<ThreadEntry[]>([]);
  const [hidden,setHidden]=useState(false);
  const [hasMore,setHasMore]=useState(false);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [matches,setMatches]=useState<Post[]>([]);
  const [finding,setFinding]=useState(false);
  const [searched,setSearched]=useState(false);
  const generation=useRef(0);
  const load=useCallback(async()=>{
    const request=++generation.current;
    setBusy(true);setError("");
    try {const result=await fetchThread(post.id,hidden);if(request===generation.current){setEntries(result.entries);setHasMore(result.hasMore);}}
    catch {if(request===generation.current)setError("Couldn't load this thread. Reconnect and retry.");}
    finally {if(request===generation.current)setBusy(false);}
  },[post.id,hidden]);
  useEffect(()=>{
    // Fetch the selected notebook thread on mount and when switching views.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  },[load,post.revision]);
  async function choice(id:string,state:"linked"|"dismissed"|null){
    setError("");
    try{await connectEntries(post.id,id,state);setMatches(all=>all.filter(p=>p.id!==id));await load();}
    catch{setError("That connection wasn't saved. Please try again.");}
  }
  async function find(e:React.FormEvent){
    e.preventDefault();setFinding(true);setError("");
    try{const result=await searchNotebook({query});setMatches(result.posts.filter(p=>p.id!==post.id));setSearched(true);}
    catch{setError("Couldn't search. Please try again.");}
    finally{setFinding(false);}
  }
  async function more(){
    const request=generation.current;
    setBusy(true);
    try{const result=await fetchThread(post.id,hidden,entries.length);if(request===generation.current){setEntries(all=>[...all,...result.entries]);setHasMore(result.hasMore);}}
    catch{if(request===generation.current)setError("Couldn't load more connections.");}finally{if(request===generation.current)setBusy(false);}
  }
  return <section className="border-t border-border px-5 py-7" aria-label="Memory thread">
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="font-script text-3xl">A thread through time</h2>
      <button onClick={()=>setHidden(v=>!v)} className="text-xs text-muted underline">{hidden?"Back to thread":"Hidden"}</button>
    </div>
    <p className="mb-7 mt-2 text-sm leading-relaxed text-muted">{hidden?"Connections you've set aside. You can bring them back.":"Earlier and later entries, connected by people, tags, topics, or you. Each link leads to your original words."}</p>
    {error&&<p role="alert" className="mb-4 text-sm">{error} <button onClick={()=>void load()} className="underline">Retry</button></p>}
    <MemoryTimeline entries={entries} onConnect={hidden?undefined:id=>void choice(id,"linked")}
      onDismiss={hidden?undefined:id=>void choice(id,"dismissed")} onRestore={hidden?id=>void choice(id,null):undefined}/>
    {busy&&<p className="text-sm text-faint">Gathering entries…</p>}
    {!busy&&!error&&!entries.length&&<p className="mb-6 text-sm text-faint">{hidden?"Nothing hidden.":"No connections yet. Add a shared tag or connect an entry below."}</p>}
    {hasMore&&<button disabled={busy} onClick={()=>void more()} className="mb-6 text-sm underline">Continue the timeline</button>}
    {!hidden&&<form onSubmit={find} className="mt-3 border-t border-border pt-5">
      <label htmlFor="connect-entry" className="text-xs uppercase tracking-widest text-faint">Connect an entry yourself</label>
      <div className="mt-3 flex items-center gap-3">
        <input id="connect-entry" value={query} onChange={e=>{setQuery(e.target.value);setSearched(false);}} placeholder="A few words you remember…" className="ink-input min-w-0 flex-1"/>
        <button disabled={finding||!query.trim()} className="text-sm underline disabled:opacity-40">{finding?"Finding…":"Find"}</button>
      </div>
      {matches.map(p=><div key={p.id} className="mt-4 border-b border-border pb-4">
        <p className="text-xs text-faint">{new Date(p.created_at).toLocaleDateString()}</p>
        <p className="my-2 line-clamp-3 text-sm">{p.content}</p>
        <button type="button" onClick={()=>void choice(p.id,"linked")} className="text-xs underline">Connect this entry</button>
      </div>)}
      {searched&&!matches.length&&<p className="mt-4 text-sm text-faint">No other entries match. Try different words.</p>}
    </form>}
  </section>;
}
