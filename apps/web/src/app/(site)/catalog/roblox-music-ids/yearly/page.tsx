import { redirect } from "next/navigation";
import { BASE_PATH } from "../page-data";

export default function YearlyMusicIdsPage() {
  redirect(`${BASE_PATH}/charts?range=yearly`);
}
