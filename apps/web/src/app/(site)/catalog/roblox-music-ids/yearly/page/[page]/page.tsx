import { redirect } from "next/navigation";
import { BASE_PATH } from "../../../page-data";

type PageProps = {
  params: Promise<{ page: string }>;
};

export default async function YearlyMusicIdsPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  redirect(`${BASE_PATH}/charts/page/${page}?range=yearly`);
}
