"use client";
import {useEffect} from "react";
import {createClient} from "@/lib/supabase/client";
import {flushDrafts,readDrafts,retryDraft,rememberAccount,QUEUE_EVENT} from "@/lib/offline";

/** Sync remains available on entry/history pages, not only while the feed is mounted. */
export default function SyncCoordinator(){
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    let stopped=false;
    const schedule=()=>{
      clearTimeout(timer);
      timer=setTimeout(async()=>{
        if(stopped||!navigator.onLine)return;
        try{if((await readDrafts()).some(d=>d.state==="pending"))await flushDrafts();}catch{/* visible in Sync */}
      },400);
    };
    const online=async()=>{
      try{for(const d of await readDrafts())if(d.state==="error")await retryDraft(d);schedule();}catch{/* kept locally */}
    };
    const {data:{subscription}}=createClient().auth.onAuthStateChange((event,session)=>{
      // Do not call Supabase auth again inside its auth-change callback.
      if(session?.user.id)void rememberAccount(session.user.id).catch(()=>{});
      else if(event==="SIGNED_OUT")void rememberAccount(null).catch(()=>{});
      schedule();
    });
    schedule();window.addEventListener(QUEUE_EVENT,schedule);window.addEventListener("online",online);
    return()=>{stopped=true;clearTimeout(timer);subscription.unsubscribe();window.removeEventListener(QUEUE_EVENT,schedule);window.removeEventListener("online",online);};
  },[]);
  return null;
}
