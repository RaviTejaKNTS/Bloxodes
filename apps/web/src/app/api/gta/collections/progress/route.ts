import { gameCollectionProgressApi } from "@/lib/game-collection-progress-api";
export const dynamic = "force-dynamic";
const handlers = gameCollectionProgressApi("gta");
export const GET = handlers.GET;
export const PUT = handlers.PUT;
