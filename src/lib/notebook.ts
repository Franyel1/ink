import { createClient } from "@/lib/supabase/client";
import { POST_SELECT, normalizePost, searchByMeaning } from "@/lib/posts";
import type { Post } from "@/lib/types";

export interface SearchFilters {
  query: string; type?: string; tagId?: string; personId?: string;
  from?: string; to?: string; meaning?: boolean;
}
export const SEARCH_PAGE_SIZE = 20;
export function dateBounds(from?: string,to?: string) {
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T00:00:00`) : null;
  if (end) end.setDate(end.getDate()+1);
  return {date_from:start?.toISOString() ?? null,date_to:end?.toISOString() ?? null};
}
export async function fetchPostIds(ids: string[]): Promise<Post[]> {
  if (!ids.length) return [];
  const { data,error } = await createClient().from("posts").select(POST_SELECT).in("id",ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map(row => {const p=normalizePost(row); return [p.id,p];}));
  return ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}
export async function searchNotebook(filters: SearchFilters,offset = 0) {
  const started = performance.now();
  let semantic: string[] = [];
  let meaningUnavailable = false;
  if (filters.meaning && filters.query.trim()) {
    const matches = await searchByMeaning(filters.query);
    semantic = matches?.map(m => m.id) ?? [];
    meaningUnavailable = matches === null;
  }
  const { data,error } = await createClient().rpc("search_notebook",{
    query_text:filters.query.slice(0,2000),filter_type:filters.type || null,
    filter_tag:filters.tagId || null,filter_person:filters.personId || null,
    ...dateBounds(filters.from,filters.to),semantic_ids:semantic,
    page_size:SEARCH_PAGE_SIZE+1,page_offset:offset,
  });
  if (error) throw error;
  const rows = data as {id:string;score:number}[];
  return {posts:await fetchPostIds(rows.slice(0,SEARCH_PAGE_SIZE).map(r => r.id)),
    hasMore:rows.length > SEARCH_PAGE_SIZE,meaningUnavailable,elapsedMs:performance.now()-started};
}
export interface ThreadEntry {post:Post; reasons:string[]; connection:"linked" | "dismissed" | null}
export async function fetchThread(sourceId:string,dismissed=false,offset=0) {
  const { data,error } = await createClient().rpc("entry_thread",{
    source_id:sourceId,include_dismissed:dismissed,page_size:21,page_offset:offset,
  });
  if (error) throw error;
  const rows = data as {id:string;reasons:string[];connection:ThreadEntry["connection"]}[];
  const posts = await fetchPostIds(rows.slice(0,20).map(r => r.id));
  return {entries:posts.map(post => ({post,...rows.find(r=>r.id===post.id)!})),hasMore:rows.length>20};
}
export async function connectEntries(sourceId:string,targetId:string,choice:"linked"|"dismissed"|null) {
  const {error} = await createClient().rpc("set_entry_connection",{source_id:sourceId,target_id:targetId,choice});
  if (error) throw error;
}
