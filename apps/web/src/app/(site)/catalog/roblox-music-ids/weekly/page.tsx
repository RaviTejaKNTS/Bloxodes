import { redirect } from "next/navigation";
import { BASE_PATH } from "../page-data";

export default function WeeklyMusicIdsPage() {
  redirect(`${BASE_PATH}/charts?range=weekly`);
}
