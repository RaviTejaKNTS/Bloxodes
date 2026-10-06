"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function CopyGameCode({ code }: { code: string }) {
  const [label, setLabel] = useState("Copy");
  return <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(code); setLabel("Copied"); } catch { setLabel("Select the code to copy"); } }}>{label}</Button>;
}
