import { redirect } from "next/navigation";
import { BASE_PATH } from "../page-data";

export default function MonthlyMusicIdsPage() {
  redirect(`${BASE_PATH}/charts?range=monthly`);
}
