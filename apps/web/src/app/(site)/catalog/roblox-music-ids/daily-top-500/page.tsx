import { redirect } from "next/navigation";
import { BASE_PATH } from "../page-data";

export default function DailyTop500MusicIdsPage() {
  redirect(`${BASE_PATH}/trending`);
}
