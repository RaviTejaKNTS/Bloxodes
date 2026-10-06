import { handleGameQuizProgress } from "@/lib/game-quiz-progress";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ namespace: string }> };
export async function GET(request: Request,context: Context) { return handleGameQuizProgress(request,(await context.params).namespace); }
export async function PUT(request: Request,context: Context) { return handleGameQuizProgress(request,(await context.params).namespace); }
