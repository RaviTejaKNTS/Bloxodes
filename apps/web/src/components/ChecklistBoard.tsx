"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChecklistViewItem as ChecklistItem } from "@/lib/engagement/types";
import { ChecklistDescription } from "@/components/ChecklistDescription";
import { trackEvent } from "@/lib/analytics";
import {
  loadAccountChecklistProgress,
  readLocalChecklistProgress,
  saveAccountChecklistProgress,
  updateChecklistProgressCount,
  useChecklistSession,
  writeLocalChecklistProgress
} from "@/lib/checklist-progress-client";

type SubSection = {
  code: string;
  name: string;
  showHeading: boolean;
  items: ChecklistItem[];
};

type TopSection = {
  topCode: string;
  label: string;
  description: string | null;
  subsections: SubSection[];
};

const PROGRESS_MILESTONES = [25, 50, 75, 100];
// Each row group is a direct child of #article-body, so ads can sit between groups.
const MAX_ROWS_PER_GROUP = 12;
const MAX_WEIGHT_PER_GROUP = 16;

function parseCodeParts(code: string): { top: number; child: number | null; leaf: number | null } {
  const parts = code.split(".").map((p) => Number.parseInt(p, 10)).filter((n) => !Number.isNaN(n));
  return {
    top: parts[0] ?? 0,
    child: parts.length > 1 ? parts[1] : null,
    leaf: parts.length > 2 ? parts[2] : null
  };
}

function parseTitleLink(raw: string): { label: string; href: string | null } {
  const trimmed = raw.trim();
  const mdMatch = trimmed.match(/^\[(.+?)\]\((https?:\/\/\S+)\)$/);
  if (mdMatch) {
    return { label: mdMatch[1], href: mdMatch[2] };
  }
  const urlMatch = trimmed.match(/(https?:\/\/\S+)/);
  if (urlMatch) {
    const href = urlMatch[1];
    const label = trimmed.replace(urlMatch[0], "").trim() || href;
    return { label, href };
  }
  return { label: trimmed, href: null };
}

function buildSections(items: ChecklistItem[]): TopSection[] {
  const parentTitles = new Map<string, string>();
  const parentDescriptions = new Map<string, string>();
  const subTitles = new Map<string, string>();
  const buckets = new Map<string, ChecklistItem[]>();

  for (const item of items) {
    const { top, child, leaf } = parseCodeParts(item.section_code.trim());
    if (leaf !== null) {
      // Tasks without a real subcategory (child 0) sit directly under the parent.
      const code = child !== null && child !== 0 ? `${top}.${child}` : `${top}.0`;
      const bucket = buckets.get(code) ?? [];
      bucket.push(item);
      buckets.set(code, bucket);
    } else if (child === null) {
      parentTitles.set(String(top), item.title.trim());
      if (item.description && !parentDescriptions.has(String(top))) {
        parentDescriptions.set(String(top), item.description);
      }
    } else {
      subTitles.set(`${top}.${child}`, item.title.trim());
    }
  }

  const tops = new Map<string, TopSection>();
  const codes = Array.from(buckets.keys()).sort((a, b) => {
    const pa = parseCodeParts(a);
    const pb = parseCodeParts(b);
    return pa.top !== pb.top ? pa.top - pb.top : (pa.child ?? -1) - (pb.child ?? -1);
  });

  for (const code of codes) {
    const { top, child } = parseCodeParts(code);
    const topCode = String(top);
    const sectionItems = (buckets.get(code) ?? []).sort((a, b) => {
      const leafA = parseCodeParts(a.section_code).leaf ?? 0;
      const leafB = parseCodeParts(b.section_code).leaf ?? 0;
      return leafA !== leafB ? leafA - leafB : a.title.localeCompare(b.title);
    });
    const hasSub = child !== null && child !== 0;
    const name = subTitles.get(code) ?? (hasSub ? `Section ${code}` : "Checklist");
    let entry = tops.get(topCode);
    if (!entry) {
      entry = {
        topCode,
        label: parentTitles.get(topCode) ?? name ?? `Section ${topCode}`,
        description: parentDescriptions.get(topCode) ?? null,
        subsections: []
      };
      tops.set(topCode, entry);
    }
    entry.subsections.push({ code, name, showHeading: hasSub, items: sectionItems });
  }

  return Array.from(tops.values());
}

/** A task with a note is taller than a plain one; roughly one extra row per 100 note characters. */
function rowWeight(item: ChecklistItem): number {
  return 1 + (item.description ? item.description.length / 100 : 0);
}

/**
 * Splits a section into consecutive groups balanced by row weight: at most
 * MAX_ROWS_PER_GROUP plain rows, fewer when tasks carry long notes.
 */
function chunkRows(items: ChecklistItem[]): ChecklistItem[][] {
  const weights = items.map(rowWeight);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const groupCount = Math.max(1, Math.ceil(items.length / MAX_ROWS_PER_GROUP), Math.ceil(total / MAX_WEIGHT_PER_GROUP));
  const target = total / groupCount;
  const chunks: ChecklistItem[][] = [];
  let cumulative = 0;
  items.forEach((item, index) => {
    const midpoint = cumulative + weights[index] / 2;
    cumulative += weights[index];
    const chunkIndex = Math.min(groupCount - 1, Math.floor(midpoint / target), chunks.length);
    (chunks[chunkIndex] ??= []).push(item);
  });
  return chunks;
}

function SectionCount({ done, total }: { done: number; total: number }) {
  return (
    <span className="checklists-count">
      <strong>{done}</strong>/{total} done
    </span>
  );
}

const ChecklistRow = memo(function ChecklistRow({
  item,
  checked,
  onToggle
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: (item: ChecklistItem) => void;
}) {
  const { label, href } = parseTitleLink(item.title);
  const inputId = `checklist-task-${item.id}`;
  return (
    <li>
      <label htmlFor={inputId} className="checklists-row">
        <input id={inputId} type="checkbox" checked={checked} onChange={() => onToggle(item)} />
        <span className="checklists-row-text">
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="checklists-row-title">
              {label}
            </a>
          ) : (
            <span className="checklists-row-title">{label}</span>
          )}
          {item.description ? (
            <span className="checklists-row-note">
              <ChecklistDescription text={item.description} />
            </span>
          ) : null}
        </span>
      </label>
    </li>
  );
});

type ChecklistBoardProps = {
  slug: string;
  items: ChecklistItem[];
};

/**
 * Renders the checklist as direct children of the parent #article-body: section
 * headings, optional notes and row groups. The structure is identical on the server
 * and after hydration; restored progress only changes checkbox state and counts.
 */
export function ChecklistBoard({ slug, items }: ChecklistBoardProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const session = useChecklistSession();
  const checkedRef = useRef(checked);
  const pendingPersistRef = useRef(false);
  const changeVersionRef = useRef(0);

  const sections = useMemo(() => buildSections(items), [items]);
  const totalLeafItems = useMemo(
    () => items.filter((item) => parseCodeParts(item.section_code.trim()).leaf !== null).length,
    [items]
  );

  useEffect(() => {
    checkedRef.current = checked;
  }, [checked]);

  useEffect(() => {
    pendingPersistRef.current = false;
    changeVersionRef.current = 0;
  }, [slug]);

  useEffect(() => {
    if (session.status !== "ready") return;

    if (pendingPersistRef.current) {
      const ids = Array.from(checkedRef.current);
      if (session.userId) {
        void saveAccountChecklistProgress(slug, ids);
        updateChecklistProgressCount(session.userId, slug, ids.length);
      } else {
        const merged = new Set(readLocalChecklistProgress(slug));
        ids.forEach((id) => merged.add(id));
        const mergedIds = Array.from(merged);
        setChecked(new Set(mergedIds));
        writeLocalChecklistProgress(slug, mergedIds);
      }
      pendingPersistRef.current = false;
      return;
    }

    if (!session.userId) {
      setChecked(new Set(readLocalChecklistProgress(slug)));
      return;
    }

    let isActive = true;
    void (async () => {
      const loadVersion = changeVersionRef.current;
      const ids = await loadAccountChecklistProgress(slug);
      if (!isActive) return;
      if (changeVersionRef.current !== loadVersion) return;
      setChecked(new Set(ids));
      updateChecklistProgressCount(session.userId, slug, ids.length);
    })();

    return () => {
      isActive = false;
    };
  }, [session.status, session.userId, slug]);

  const lastMilestoneRef = useRef(0);
  const milestonesInitialized = useRef(false);

  const toggleItem = useCallback(
    (item: ChecklistItem) => {
      const sessionReady = session.status === "ready";
      changeVersionRef.current += 1;
      setChecked((prev) => {
        const next = new Set(prev);
        const nextChecked = !next.has(item.id);
        if (nextChecked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
        const nextIds = Array.from(next);

        if (sessionReady) {
          if (session.userId) {
            void saveAccountChecklistProgress(slug, nextIds);
            updateChecklistProgressCount(session.userId, slug, nextIds.length);
          } else {
            writeLocalChecklistProgress(slug, nextIds);
          }
        } else {
          pendingPersistRef.current = true;
        }
        trackEvent("checklist_item_toggle", {
          checklist_slug: slug,
          item_id: item.id,
          section_code: item.section_code,
          checked: nextChecked
        });
        return next;
      });
    },
    [session.status, session.userId, slug]
  );

  useEffect(() => {
    lastMilestoneRef.current = 0;
    milestonesInitialized.current = false;
  }, [slug, totalLeafItems]);

  useEffect(() => {
    if (!totalLeafItems) return;
    const percent = Math.round((checked.size / totalLeafItems) * 100);
    const reached = PROGRESS_MILESTONES.filter((value) => percent >= value).pop() ?? 0;
    if (!milestonesInitialized.current) {
      lastMilestoneRef.current = reached;
      milestonesInitialized.current = true;
      return;
    }
    for (const milestone of PROGRESS_MILESTONES) {
      if (milestone > lastMilestoneRef.current && percent >= milestone) {
        trackEvent("checklist_progress", {
          checklist_slug: slug,
          percent: milestone,
          done: checked.size,
          total: totalLeafItems
        });
        lastMilestoneRef.current = milestone;
      }
    }
  }, [checked.size, slug, totalLeafItems]);

  useEffect(() => {
    const detail = { slug, checkedCount: checked.size, totalCount: items.length };
    window.dispatchEvent(new CustomEvent("checklist-progress", { detail }));
  }, [slug, checked, items.length]);

  if (!sections.length) {
    return <p className="checklists-note">No checklist items yet.</p>;
  }

  const countDone = (list: ChecklistItem[]) => list.reduce((sum, item) => sum + (checked.has(item.id) ? 1 : 0), 0);

  return (
    <>
      {sections.map((section) => {
        const sectionItems = section.subsections.flatMap((sub) => sub.items);
        return (
          <Fragment key={section.topCode}>
            <div className="checklists-section-head">
              <h2 id={`section-${section.topCode}`}>
                {section.topCode}. {section.label}
              </h2>
              <SectionCount done={countDone(sectionItems)} total={sectionItems.length} />
            </div>
            {section.description ? (
              <p className="checklists-note">
                <ChecklistDescription text={section.description} />
              </p>
            ) : null}
            {section.subsections.map((sub) => (
              <Fragment key={sub.code}>
                {sub.showHeading ? (
                  <div className="checklists-subhead">
                    <h3 id={`section-${sub.code}`}>
                      {sub.code} {sub.name}
                    </h3>
                    <SectionCount done={countDone(sub.items)} total={sub.items.length} />
                  </div>
                ) : null}
                {chunkRows(sub.items).map((rows, index) => (
                  <ul key={`${sub.code}-${index}`} className="checklists-group" data-checklist-group>
                    {rows.map((item) => (
                      <ChecklistRow key={item.id} item={item} checked={checked.has(item.id)} onToggle={toggleItem} />
                    ))}
                  </ul>
                ))}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
