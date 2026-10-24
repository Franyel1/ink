import type {Post,Tag} from "./types";

const owner="demo-notebook";
export const DEMO_TAGS:Tag[]=["Career","Home","Running"].map(name=>({id:name.toLowerCase(),name,user_id:owner,created_at:"2026-01-01T12:00:00Z"}));
const moments:[string,string,string,string][]=[
  ["2026-01-08","career","Maya sent me a design apprenticeship. I bookmarked it instead of applying. Apparently saving a link feels enough like doing something.","Maya"],
  ["2026-01-20","home","First dinner in the new apartment. No table yet. Sam called our floor picnic a housewarming.","Sam"],
  ["2026-02-03","running","Ran for six minutes before walking. Writing that down so I don't remember this as starting effortlessly.",""],
  ["2026-02-16","career","Sent the application. Three paragraphs took two evenings. Maya said the point was to send it, not to become fearless first.","Maya"],
  ["2026-03-02","home","Sam brought basil for the windowsill. The kitchen finally smells like somebody lives here.","Sam"],
  ["2026-03-14","running","A full mile without stopping. I went slowly enough to notice the bakery opening.",""],
  ["2026-03-27","career","Interview tomorrow. My portfolio has a broken link and one project I actually love. Fixed the link. Keeping the project.",""],
  ["2026-04-06","career","Got the apprenticeship. Called Maya from the station. Missed my train because we kept laughing.","Maya"],
  ["2026-04-21","home","Dinner for four around the new table. Sam burned the bread. Everyone asked for seconds anyway.","Sam"],
  ["2026-05-11","career","First design review. I thought asking questions would make me look unprepared. It made the work better.",""],
  ["2026-05-23","running","Signed up for the neighborhood 5K. The goal is to finish and still want breakfast.",""],
  ["2026-06-07","running","Finished the 5K. Walked one hill. Had the best breakfast of the year. Six-minute me would be delighted.",""],
  ["2026-06-19","career","Maya asked me to look over her application. Strange to be on this side of the conversation.","Maya"],
  ["2026-07-04","home","The basil is taking over. Sent Sam home with a bag of leaves and the container I borrowed in January.","Sam"],
  ["2026-07-22","career","Presented the project today. I still got nervous. This time I knew that feeling didn't mean I wasn't ready.",""],
  ["2026-08-09","running","Rainy morning. Went anyway, slowly. Running is becoming a place to think instead of a number to improve.",""],
  ["2026-08-28","home","Found the photo of our first floor picnic. The apartment looked empty. It doesn't feel like that memory was empty, though.","Sam"],
  ["2026-09-15","career","Helped the new apprentice get ready for her first review. Told her questions count as preparation. I think I finally believe that myself.",""],
];
export const DEMO_POSTS:Post[]=moments.map(([date,topic,content,person],i)=>({
  id:`memory-${i+1}`,user_id:owner,content,post_type:"memory",revision:1,is_pinned:false,
  created_at:`${date}T12:00:00Z`,updated_at:`${date}T12:00:00Z`,
  post_images:[],post_tags:[{tag_id:topic,tags:DEMO_TAGS.find(t=>t.id===topic)!}],
  post_people:person?[{person_id:person,people:{id:person,name:person}}]:[],
  ai_processed:false,ai_comment:null,ai_summary:null,ai_sentiment:null,ai_topics:null,
}));
