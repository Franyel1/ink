"use client";
import {useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {DEMO_POSTS,DEMO_TAGS} from "@/lib/demo-data";
import type {Post} from "@/lib/types";
import MemoryTimeline from "@/components/MemoryTimeline";

export default function DemoScreen(){
  const params=useSearchParams();
  const [posts,setPosts]=useState(DEMO_POSTS);
  const [selected,setSelected]=useState(()=>DEMO_POSTS.find(p=>p.id===params.get("entry"))??DEMO_POSTS.at(-1)!);
  const [query,setQuery]=useState("");
  const [topic,setTopic]=useState("");
  const [hidden,setHidden]=useState<string[]>([]);
  const [linked,setLinked]=useState<string[]>([]);
  const [tab,setTab]=useState<"notebook"|"sync">("notebook");
  const [offline,setOffline]=useState(false);
  const [draft,setDraft]=useState("");
  const [queued,setQueued]=useState<{postId:string;content:string}|null>(null);
  const [histories,setHistories]=useState<Record<string,string[]>>({});
  const history=histories[selected.id]??[];
  const [status,setStatus]=useState("");
  const results=[...posts].reverse().filter(p=>(!query||p.content.toLowerCase().includes(query.toLowerCase()))&&(!topic||p.post_tags.some(t=>t.tag_id===topic)));
  const connections=posts.filter(p=>p.id!==selected.id&&!hidden.includes([p.id,selected.id].sort().join(":")))
    .flatMap(post=>{
      const pair=[post.id,selected.id].sort().join(":");
      const reasons=[];
      if(linked.includes(pair))reasons.push("Connected by you");
      if(post.post_tags.some(t=>selected.post_tags.some(s=>s.tag_id===t.tag_id)))reasons.push("Shared tag");
      if(post.post_people?.some(t=>selected.post_people?.some(s=>s.person_id===t.person_id)))reasons.push("Same person");
      return reasons.length?[{post,reasons,connection:linked.includes(pair)?"linked" as const:null}]:[];
    });
  function open(post:Post){setSelected(post);setStatus("");document.getElementById("demo-thread")?.scrollIntoView({behavior:"smooth",block:"start"});}
  function save(){
    if(!draft.trim())return;
    if(offline){setQueued({postId:selected.id,content:draft});setStatus("Saved in this demo session. Reconnect to sync it.");}
    else{setHistories(all=>({...all,[selected.id]:[selected.content,...(all[selected.id]??[])]}));const next={...selected,content:draft,revision:(selected.revision??1)+1};setSelected(next);setPosts(all=>all.map(p=>p.id===next.id?next:p));setStatus("Saved. The previous words are in version history.");}
    setDraft("");
  }
  function reconnect(){
    setOffline(false);
    if(queued){
      const target=posts.find(p=>p.id===queued.postId)!;
      setHistories(all=>({...all,[target.id]:[target.content,...(all[target.id]??[])]}));
      const next={...target,content:queued.content,revision:(target.revision??1)+1};
      if(selected.id===target.id)setSelected(next);
      setPosts(all=>all.map(p=>p.id===next.id?next:p));setQueued(null);setStatus("Synced once. Your earlier version is still recoverable.");
    }
  }
  return <main className="scroll-area h-full px-5 pb-14 pt-6 md:px-12 md:pt-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-baseline justify-between border-b border-border pb-5">
        <Link href="/demo" className="font-script text-5xl">Ink.</Link>
        <span className="text-[10px] uppercase tracking-[0.2em] text-faint">A fictional notebook</span>
        <Link href="/login" className="text-sm text-muted underline">Your own ink →</Link>
      </header>
      <div className="max-w-2xl py-10 md:py-14">
        <p className="text-xs uppercase tracking-[0.23em] text-faint">January — September 2026</p>
        <h1 className="font-script mt-4 text-5xl leading-tight md:text-7xl">You change.<br/>Your words remember.</h1>
        <p className="mt-5 max-w-lg text-sm leading-7 text-muted">Follow Alex from an unsent application to helping someone else begin. Open a moment, trace its connections, or try keeping an edit without a connection.</p>
      </div>
      <nav aria-label="Demo sections" className="mb-8 flex gap-7 border-b border-border pb-4 text-sm">
        <button onClick={()=>setTab("notebook")} aria-pressed={tab==="notebook"} className={tab==="notebook"?"underline underline-offset-8":"text-muted"}>Explore the notebook</button>
        <button onClick={()=>{setTab("sync");setDraft(selected.content);}} aria-pressed={tab==="sync"} className={tab==="sync"?"underline underline-offset-8":"text-muted"}>Try offline & recovery</button>
      </nav>
      {tab==="notebook"?<div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
        <section aria-label="Demo search">
          <label className="text-xs uppercase tracking-widest text-faint" htmlFor="demo-search">Find a moment</label>
          <input id="demo-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try “application” or “Maya”…" className="ink-input write-line mt-3 w-full pb-3"/>
          <div className="my-5 flex flex-wrap gap-5 text-xs">
            {[{id:"",name:"All entries"},...DEMO_TAGS].map(t=><button key={t.id} aria-pressed={topic===t.id} onClick={()=>setTopic(t.id)} className={topic===t.id?"underline underline-offset-4":"text-faint"}>{t.name}</button>)}
          </div>
          <p className="mb-4 text-xs text-faint">{results.length} moments · search spans every month</p>
          <div className="md:scroll-area md:max-h-[650px]">
            {results.map(p=><button key={p.id} onClick={()=>open(p)} aria-pressed={selected.id===p.id} className={`block w-full border-b border-border py-5 text-left ${selected.id===p.id?"border-l-2 pl-4":""}`}>
              <span className="text-xs text-faint">{new Date(p.created_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})} · {p.post_tags[0]?.tags.name}</span>
              <span className="mt-2 block text-sm leading-6">{p.content}</span>
              <span className="mt-2 block text-xs text-muted">Trace this moment ↗</span>
            </button>)}
            {!results.length&&<p className="py-8 text-sm text-muted">No moments found. Try a different word.</p>}
          </div>
        </section>
        <section id="demo-thread" aria-label="Demo memory thread">
          <p className="text-xs uppercase tracking-widest text-faint">The moment you chose</p>
          <blockquote className="font-script my-5 text-3xl leading-snug">{selected.content}</blockquote>
          <p className="mb-8 text-xs text-muted">{new Date(selected.created_at).toLocaleDateString()} · original entry</p>
          <h2 className="font-script text-3xl">A thread through time</h2>
          <p className="mb-7 mt-2 text-sm text-muted">{connections.length} connections. Your words, in order.</p>
          <div>
            <MemoryTimeline entries={connections} hrefFor={id=>`/demo?entry=${id}`} onOpen={open}
              onConnect={id=>setLinked(all=>[...all,[id,selected.id].sort().join(":")])}
              onDismiss={id=>{const pair=[id,selected.id].sort().join(":");setHidden(all=>[...all,pair]);setLinked(all=>all.filter(p=>p!==pair));}}/>
          </div>
          {!!hidden.length&&<button className="text-xs underline" onClick={()=>setHidden([])}>Restore hidden connections</button>}
        </section>
      </div>:<section className="max-w-2xl">
        <h2 className="font-script text-3xl">Let the signal come and go.</h2>
        <p className="mt-3 text-sm leading-6 text-muted">This is a simulation using fictional text. Changes stay in this tab until you reload. Your real notebook uses durable device storage and checks for conflicting versions.</p>
        <div className="my-6 flex items-center justify-between border-y border-border py-4 text-sm">
          <span>{offline?"Simulated offline":"Simulated online"}</span>
          <button className="underline" onClick={()=>offline?reconnect():setOffline(true)}>{offline?"Reconnect & sync":"Go offline"}</button>
        </div>
        <label className="block text-xs uppercase tracking-widest text-faint" htmlFor="demo-edit">Edit this moment</label>
        <textarea id="demo-edit" rows={5} value={draft} onChange={e=>setDraft(e.target.value)} className="ink-input mt-4 w-full resize-y leading-7" placeholder={selected.content}/>
        <button onClick={save} disabled={!draft.trim()||!!queued} className="mt-5 text-sm underline disabled:opacity-40">{offline?"Keep edit on this device":"Save edit"}</button>
        <p role="status" className="my-5 text-sm text-muted">{status}</p>
        {queued&&<div className="border-l border-border pl-4"><p className="text-xs text-faint">Waiting to sync</p><p className="mt-2 text-sm">{queued.content}</p></div>}
        {!!history.length&&<div className="mt-8 border-t border-border pt-5">
          <h3 className="font-script text-2xl">Earlier words</h3>
          {history.map((text,i)=><div key={i} className="py-4"><p className="text-sm leading-6">{text}</p><button disabled={offline||!!queued} className="mt-2 text-xs underline disabled:opacity-40" onClick={()=>{
            setHistories(all=>({...all,[selected.id]:[selected.content,...(all[selected.id]??[])]}));const next={...selected,content:text,revision:(selected.revision??1)+1};setSelected(next);setPosts(all=>all.map(p=>p.id===next.id?next:p));setStatus("Earlier words restored as a new version.");
          }}>Restore these words</button></div>)}
        </div>}
      </section>}
      <footer className="mt-12 border-t border-border pt-6 text-xs leading-6 text-faint">All people and entries in this demo are fictional. No account, API key, or AI service needed. <button className="underline" onClick={()=>window.location.reload()}>Reset the demo</button></footer>
    </div>
  </main>;
}
