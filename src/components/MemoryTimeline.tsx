import Link from "next/link";
import type {ThreadEntry} from "@/lib/notebook";

export default function MemoryTimeline({entries,hrefFor,onOpen,onConnect,onDismiss,onRestore}: {
  entries:ThreadEntry[]; hrefFor?:(id:string)=>string;
  onOpen?:(post:ThreadEntry["post"])=>void;
  onConnect?:(id:string)=>void;onDismiss?:(id:string)=>void;onRestore?:(id:string)=>void;
}) {
  return <ol className="ml-1 border-l border-border pl-6">
    {entries.map(({post,reasons,connection})=><li key={post.id} className="relative pb-8">
      <span aria-hidden className="absolute -left-[29px] top-1 h-2 w-2 rounded-full bg-muted"/>
      <p className="text-xs text-faint">{new Date(post.created_at).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</p>
      <Link href={hrefFor?.(post.id)??`/post/${post.id}`} onClick={onOpen?event=>{
        if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onOpen(post);}
      }:undefined} className="mt-2 block whitespace-pre-wrap text-sm leading-relaxed hover:underline">{post.content}</Link>
      <p className="mt-2 text-xs text-muted">{reasons.join(" · ") || "Hidden connection"}</p>
      <div className="mt-3 flex gap-5 text-xs text-muted">
        {connection!=="linked"&&onConnect&&<button onClick={()=>onConnect(post.id)} className="underline">Connect</button>}
        {onDismiss&&<button onClick={()=>onDismiss(post.id)} className="underline">{connection==="linked"?"Disconnect & hide":"Hide suggestion"}</button>}
        {onRestore&&<button onClick={()=>onRestore(post.id)} className="underline">Show again</button>}
      </div>
    </li>)}
  </ol>;
}
