import { NextResponse } from "next/server";
import { gameCollectionProgressApi } from "@/lib/game-collection-progress-api";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ namespace: string }> };
async function handle(request: Request, context: Context, method: "GET" | "PUT") {
 const { namespace } = await context.params;
 if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace) || namespace === "roblox") return NextResponse.json({ error: "Unknown game." }, { status: 404 });
 return gameCollectionProgressApi(namespace)[method](request);
}
export function GET(request: Request, context: Context) { return handle(request, context, "GET"); }
export function PUT(request: Request, context: Context) { return handle(request, context, "PUT"); }
