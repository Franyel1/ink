"use client";
import {useState} from "react";
import Link from "next/link";
import type {Post} from "@/lib/types";
import {createClient} from "@/lib/supabase/client";
import {flushDrafts,queueDraft} from "@/lib/offline";

interface Version {revision:number;content:string;post_type:Post["post_type"];tag_ids:string[];saved_at:string}
export default function VersionHistory({post,onRestored}:{post:Post;onRestored:(p:Post)=>void}) {
  const [versions,setVersions]=useState<Version[]|null>(null);
  const [open,setOpen]=useState(false);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [hasMore,setHasMore]=useState(false);
  async function load(offset=0){
    setBusy(true);setMessage("");
    const {data,error}=await createClient().from("post_versions")
      .select("revision,content,post_type,tag_ids,saved_at").eq("post_id",post.id)
      .order("revision",{ascending:false}).range(offset,offset+20);
    if(error)setMessage("Couldn't load versions. Reconnect and try again.");
    else{setVersions(all=>offset?[...(all??[]),...(data??[]).slice(0,20)]:(data??[]).slice(0,20));setHasMore((data??[]).length>20);}
    setBusy(false);
  }
  async function restore(version:Version){
    setBusy(true);setMessage("");
    try{
      await queueDraft({content:version.content,postType:version.post_type,tagIds:version.tag_ids,newFiles:[]},post);
      const saved=(await flushDrafts()).find(p=>p.id===post.id);
      if(saved){onRestored(saved);setMessage("Restored. The version you replaced is kept in history.");setOpen(false);}
      else setMessage("Restoration saved on this device. Review Sync to finish.");
    }catch(e){setMessage(e instanceof Error?e.message:"Couldn't restore this version.");}
    finally{setBusy(false);}
  }
  return <section className="border-t border-border px-5 py-5">
    <button onClick={()=>{setOpen(!open);if(!open)void load();}} aria-expanded={open} className="text-sm underline">Version history · v{post.revision??1}</button>
    {message&&<p role="status" className="mt-3 text-sm text-muted">{message} <Link href="/sync" className="underline">Sync</Link></p>}
    {open&&<div className="mt-4">
      <p className="mb-4 text-xs text-faint">Restore words, entry type, and tags. Photos stay attached. Restoring creates a new version.</p>
      {versions?.map(v=><article key={v.revision} className="border-b border-border py-4">
        <p className="text-xs text-faint">Version {v.revision} · {new Date(v.saved_at).toLocaleString()}</p>
        <p className="my-3 whitespace-pre-wrap text-sm leading-relaxed" data-selectable>{v.content}</p>
        <button disabled={busy} onClick={()=>void restore(v)} className="text-xs underline disabled:opacity-40">Restore this version</button>
      </article>)}
      {busy&&<p className="py-3 text-sm">Loading…</p>}
      {versions?.length===0&&!busy&&<p className="text-sm text-faint">Your next edit will keep this version here.</p>}
      {hasMore&&<button disabled={busy} onClick={()=>void load(versions?.length??0)} className="mt-4 text-sm underline">Older versions</button>}
    </div>}
  </section>;
}
