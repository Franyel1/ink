"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import type {Post} from "@/lib/types";
import {refetchPost} from "@/lib/posts";
import {discardDraft,flushDrafts,readDrafts,readLegacyDrafts,retryDraft,reviseDraft,QUEUE_EVENT,type QueuedDraft} from "@/lib/offline";

async function exportDrafts(drafts:QueuedDraft[],filename:string){
  const rows=await Promise.all(drafts.map(async d=>({...d,files:await Promise.all(d.files.map(async file=>({
    name:file.name,type:file.type,dataUrl:await new Promise<string>((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);
    }),
  })))})));
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:"ink-draft-backup-v1",drafts:rows},null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function DraftReview({draft,onChange}:{draft:QueuedDraft;onChange:()=>void}) {
  const [current,setCurrent]=useState<Post|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [text,setText]=useState(draft.content);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function act(action:()=>Promise<void>){
    setBusy(true);setError("");
    try{await action();onChange();}catch(e){setError(e instanceof Error?e.message:"Couldn't finish. Your writing is still here.");}
    finally{setBusy(false);}
  }
  async function compare(){
    const post=await refetchPost(draft.postId).catch((e)=>{
      if(e?.code==="PGRST116")return null;throw e;
    });
    setCurrent(post);setLoaded(true);
  }
  return <article className="border-b border-border py-6">
    <div className="flex justify-between gap-3 text-xs text-faint">
      <span>{draft.baseRevision===null?"New entry":"Edit"} · {new Date(draft.createdAt).toLocaleString()}</span>
      <span>{draft.state==="conflict"?"Needs your choice":draft.state==="error"?"Needs a retry":"Waiting to sync"}</span>
    </div>
    <p className="my-3 whitespace-pre-wrap text-sm leading-relaxed" data-selectable>{draft.content}</p>
    {draft.files.length>0&&<p className="mb-3 text-xs text-muted">{draft.files.length} attached image(s) kept on this device</p>}
    {draft.error&&<p className="mb-3 text-xs text-muted">{draft.error}</p>}
    {error&&<p role="alert" className="mb-3 text-sm">{error}</p>}
    {draft.state==="conflict"&&loaded&&<div className="my-5 border-l border-border pl-4">
      <p className="text-xs uppercase tracking-widest text-faint">{current?`Saved version · v${current.revision??1}`:"Original entry was deleted"}</p>
      {current&&<p className="my-3 whitespace-pre-wrap text-sm" data-selectable>{current.content}</p>}
      <label className="mt-5 block text-xs text-faint">Your version, editable before saving
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={5} className="ink-input mt-3 w-full resize-y text-sm leading-relaxed"/>
      </label>
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        {current&&<button disabled={busy||!text.trim()} className="underline" onClick={()=>void act(async()=>{await reviseDraft(draft,current,text);await flushDrafts();})}>Save my version</button>}
        <button disabled={busy||!text.trim()} className="underline" onClick={()=>void act(async()=>{await reviseDraft(draft,current,text,true);await flushDrafts();})}>Keep as a separate entry</button>
      </div>
      <p className="mt-3 text-xs text-muted">Saving over a newer edit keeps its words in version history. If it changes again, Ink will ask you to compare again.</p>
    </div>}
    <div className="flex flex-wrap gap-5 text-xs text-muted">
      {draft.state==="conflict"?<button disabled={busy} className="underline" onClick={()=>void act(compare)}>Compare versions</button>:
        <button disabled={busy} className="underline" onClick={()=>void act(async()=>{await retryDraft(draft);await flushDrafts();})}>Retry sync</button>}
      <button disabled={busy} className="underline" onClick={()=>{
        if(window.confirm("Discard this unsynced writing from this device?"))void act(()=>discardDraft(draft.id));
      }}>Discard local {draft.baseRevision===null?"entry":"edit"}</button>
      {draft.baseRevision!==null&&<Link href={`/post/${draft.postId}`} className="underline">Open saved entry</Link>}
    </div>
  </article>;
}
export default function SyncPanel(){
  const [drafts,setDrafts]=useState<QueuedDraft[]>([]);
  const [legacy,setLegacy]=useState<QueuedDraft[]>([]);
  const [error,setError]=useState("");
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    try{setDrafts(await readDrafts());setLegacy(await readLegacyDrafts());setReady(true);}
    catch{setError("Couldn't read this device's drafts. Please reload before writing more.");}
  },[]);
  useEffect(()=>{
    // Initial cache hydration and subsequent IndexedDB changes are external state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    window.addEventListener(QUEUE_EVENT,load);
    return()=>window.removeEventListener(QUEUE_EVENT,load);
  },[load]);
  async function sync(){
    setBusy(true);setError("");
    try{for(const draft of drafts.filter(d=>d.state!=="conflict"))await retryDraft(draft);await flushDrafts();await load();}
    catch{setError("Couldn't sync. Your local writing is still here.");}finally{setBusy(false);}
  }
  return <div className="scroll-area flex-1 px-5 pb-12 pt-6">
    <Link href="/feed" className="text-sm text-muted">← Your notebook</Link>
    <h1 className="font-script mt-6 text-4xl">Kept on this device</h1>
    <p className="mb-6 mt-3 text-sm leading-relaxed text-muted">Your unsynced writing stays here until it is safely saved. Conflicting edits wait for your choice.</p>
    <div className="flex gap-6">
      <button disabled={busy||!drafts.length} onClick={()=>void sync()} className="text-sm underline disabled:opacity-40">{busy?"Syncing…":"Sync now"}</button>
      <button disabled={!drafts.length} onClick={()=>void exportDrafts(drafts,"ink-pending-writing.json").catch(()=>setError("Couldn't export. Your drafts are still on this device."))} className="text-sm underline disabled:opacity-40">Export pending writing</button>
    </div>
    {error&&<p role="alert" className="my-4 text-sm">{error}</p>}
    {drafts.map(d=><DraftReview key={d.id} draft={d} onChange={()=>void load()}/>)}
    {ready&&!drafts.length&&<p className="mt-10 font-script text-2xl text-muted">Nothing waiting. Your notebook is up to date on this device.</p>}
    {legacy.length>0&&<section className="mt-8 border-t border-border pt-5">
      <h2 className="text-sm">Writing from an older version</h2>
      <p className="my-3 text-xs text-muted">These drafts predate account labels. They will never be sent automatically. Export them to review and copy into the right account.</p>
      <button className="text-sm underline" onClick={()=>void exportDrafts(legacy,"ink-recovered-drafts.json").catch(()=>setError("Couldn't export recovered writing. Please try again."))}>Export recovered writing</button>
      <p className="mt-2 text-xs text-faint">The JSON backup includes text and attached image data.</p>
    </section>}
  </div>;
}
