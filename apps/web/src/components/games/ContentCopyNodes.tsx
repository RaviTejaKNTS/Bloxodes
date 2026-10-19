import { Children, type ReactNode } from "react";

// Each copy block keeps its typography scope while exposing an ad boundary.
export function ContentCopyNodes({ nodes, className = "", group = "copy" }: { nodes: ReactNode; className?: string; group?: string }) {
  return Children.toArray(nodes).filter(node => typeof node !== "string" || node.trim()).map((node, index) => (
    <div key={`${group}-${index}`} data-content-copy={group} className={`ads-content-copy article-content md-copy-scope ${className}`}>
      {node}
    </div>
  ));
}

