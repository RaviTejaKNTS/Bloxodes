"use client";

import { Fragment } from "react";
import { parseChecklistDescription } from "@/lib/checklist-description";

export function ChecklistDescription({ text }: { text: string }) {
  return <>{parseChecklistDescription(text).map((part, index) => part.href ? (
    <a key={index} href={part.href} className="text-accent underline underline-offset-2" onClick={event => event.stopPropagation()}>
      {part.text}
    </a>
  ) : <Fragment key={index}>{part.text}</Fragment>)}</>;
}
