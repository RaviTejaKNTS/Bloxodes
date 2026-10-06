"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
export function ResourceCostTool({ unitCost, resourceLabel }: { unitCost: number; resourceLabel: string }) {
  const [quantity, setQuantity] = useState("1");
  const count = Number(quantity);
  const valid = quantity.trim() !== "" && Number.isSafeInteger(count) && count >= 0 && count <= 1000000000 && Number.isFinite(count * unitCost);
  return <section className="space-y-4 rounded-xl border border-border p-6"><label htmlFor="resource-quantity" className="block font-medium">Quantity</label><Input id="resource-quantity" type="number" min="0" max="1000000000" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /><output aria-live="polite" className="block text-xl">{valid ? `${(count * unitCost).toLocaleString("en-US")} ${resourceLabel}` : "Enter a whole number from 0 to 1,000,000,000."}</output></section>;
}
