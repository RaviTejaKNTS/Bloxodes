import type { QuizData } from "@/lib/quiz-types";

/** Presentation contracts contain no platform database identities. */
export type EngagementIndexConfig = {
  basePath: string;
  title: string;
  heading: string;
  intro: string;
  description: string;
};
export type ChecklistConfig = EngagementIndexConfig & { progressNamespace: string };
export type QuizProgressConfig = { sessionEndpoint: string; progressEndpoint: string };
export type QuizConfig = EngagementIndexConfig & {
  homePath: string;
  progressNamespace: string;
  progress: QuizProgressConfig;
};
export type EngagementPageCopy = {
  title: string;
  description_md?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  content_updated_at?: string | null;
  image?: string | null;
};
export type ChecklistViewItem = {
  id: string;
  section_code: string;
  title: string;
  description: string | null;
  is_required: boolean;
};
export type ChecklistTemplatePage = EngagementPageCopy & {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
};
export type ChecklistTemplateData = { page: ChecklistTemplatePage; items: ChecklistViewItem[] };
export type ChecklistCardData = {
  id: string;
  slug: string;
  href: string;
  gameName: string | null;
  title: string;
  summary: string;
  coverImage: string | null;
  updatedAt: string | null;
  updatedLabel: string | null;
  itemsCount: number | null;
};
export type QuizCardData = {
  code: string;
  href: string;
  gameName: string | null;
  title: string;
  summary: string;
  coverImage: string | null;
  updatedAt: string | null;
  updatedLabel: string | null;
};
export type QuizTemplateData = {
  page: EngagementPageCopy & { code: string; gameName: string };
  questions: QuizData;
};

export function engagementProgressKey(namespace: string, slug: string) {
  return namespace ? `${namespace}:${slug}` : slug;
}
