import { redirect } from "next/navigation";
import { BASE_PATH } from "../../../page-data";

type PageProps = {
  params: Promise<{ page: string }>;
};

export default async function DailyTop500MusicIdsPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  redirect(`${BASE_PATH}/trending/page/${page}`);
}
