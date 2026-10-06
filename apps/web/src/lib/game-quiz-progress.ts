import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser } from "./auth/session-user";
import { supabaseAdmin } from "./supabase";
import { isTrustedMutationOrigin } from "./security/request";
import { checkRateLimit } from "./security/rate-limit";
import { parseGameQuizData } from "./game-page-data";

const json = (value: unknown, status = 200) => NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store, max-age=0"}});
export async function handleGameQuizProgress(request: Request, namespace: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace) || namespace === "roblox") return json({error:"Invalid game."},400);
  if (request.method !== "GET" && !isTrustedMutationOrigin(request)) return json({error:"Invalid request origin."},403);
  try {
    const user = await getSessionUser();
    if (!user) return json({error:"Unauthorized"},401);
    const payload = request.method === "GET" ? null : await request.json().catch(()=>null);
    const code = request.method === "GET" ? new URL(request.url).searchParams.get("code") : payload?.code;
    if (typeof code !== "string" || !code.startsWith(`${namespace}:`) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code.slice(namespace.length+1))) return json({error:"Invalid quiz code."},400);
    const sb = supabaseAdmin();
    const { data: page,error } = await sb.from("game_quiz_pages_view").select("id,quiz_data").eq("namespace",namespace).eq("slug",code.slice(namespace.length+1)).maybeSingle();
    if (error) throw error;
    if (!page) return json({error:"Unknown quiz."},404);
    const questions = parseGameQuizData(page.quiz_data);
    const validIds = new Set(Object.values(questions).flat().map(question=>question.id));
    const { data: saved,error: readError } = await sb.from("game_quiz_progress").select("seen_question_ids,last_score,last_total,last_breakdown,last_attempt_at").eq("user_id",user.id).eq("quiz_page_id",page.id).eq("namespace",namespace).maybeSingle();
    if (readError) throw readError;
    if (request.method === "GET") return json({seenQuestionIds:(saved?.seen_question_ids ?? []).filter((id:string)=>validIds.has(id)),lastScore:saved?.last_score ?? null,lastTotal:saved?.last_total ?? null,lastBreakdown:saved?.last_breakdown ?? {},lastAttemptAt:saved?.last_attempt_at ?? null});
    const rate = checkRateLimit({key:`game-quiz-progress:${user.id}`,limit:60,windowMs:60000});
    if (!rate.allowed) return json({error:"Please try again shortly."},429);
    if (!Array.isArray(payload?.questionIds) || payload.questionIds.length>3000 || payload.questionIds.some((id:unknown)=>typeof id!=="string" || !validIds.has(id)) || !Number.isInteger(payload.score) || !Number.isInteger(payload.total) || payload.score<0 || payload.score>payload.total || payload.total<1 || payload.total>15 || payload.total>validIds.size) return json({error:"Invalid quiz result."},400);
    const breakdown: Record<string,{correct:number;total:number}> = {};
    for (const level of ["easy","medium","hard"] as const) {
      const value=payload.breakdown?.[level];
      if (!value || !Number.isInteger(value.correct) || !Number.isInteger(value.total) || value.correct<0 || value.correct>value.total || value.total>Math.min(5,questions[level].length)) return json({error:"Invalid quiz breakdown."},400);
      breakdown[level]={correct:value.correct,total:value.total};
    }
    if (Object.values(breakdown).reduce((sum,value)=>sum+value.correct,0)!==payload.score || Object.values(breakdown).reduce((sum,value)=>sum+value.total,0)!==payload.total) return json({error:"Quiz totals do not match."},400);
    const { error: saveError } = await sb.rpc("save_game_quiz_progress", {
      target_user: user.id, target_page: page.id, target_namespace: namespace,
      question_ids: [...new Set<string>(payload.questionIds)], score: payload.score,
      total: payload.total, breakdown,
    });
    if (saveError) throw saveError;
    return json({ok:true});
  } catch (error) { console.error("Game quiz progress failed",error);return json({error:"Unable to save or load quiz progress."},500); }
}
