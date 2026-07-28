"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Heart, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SiteFeedbackButtonProps = {
  className?: string;
  labelClassName?: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function SiteFeedbackButton({ className, labelClassName }: SiteFeedbackButtonProps) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setState("error");
      setMessage("Please write a little feedback first.");
      return;
    }

    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmedBody,
          email: email.trim(),
          pageUrl: window.location.href,
          pagePath: pathname,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to send feedback.");
      }

      setState("success");
      setMessage("Thanks. We got it.");
      setBody("");
      setEmail("");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to send feedback.");
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) return;
    if (state !== "submitting") {
      setState("idle");
      setMessage("");
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-9 shrink-0 gap-2 rounded-md px-3 text-[13px] font-semibold text-muted hover:bg-muted/60 hover:text-foreground",
            className
          )}
          aria-label="Give feedback to improve Bloxodes"
          title="Give feedback to improve Bloxodes"
        >
          <Heart aria-hidden className="h-4 w-4" />
          <span className={cn("hidden lg:inline", labelClassName)}>Give feedback</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(24rem,_92vw)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Improve Bloxodes</SheetTitle>
          <SheetDescription>Tell us what would make this page or the site more useful.</SheetDescription>
        </SheetHeader>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Feedback</span>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              required
              placeholder="What should we improve?"
              className="min-h-36 resize-none"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Email optional</span>
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              maxLength={160}
              placeholder="you@example.com"
            />
          </label>

          <p className="text-xs leading-5 text-muted-foreground">
            We also receive this page&apos;s URL, basic device details, and request information so we can understand and protect this
            feedback channel. Read our{" "}
            <Link href="/privacy-policy" className="text-foreground underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          {message ? (
            <p
              className={cn(
                "text-sm",
                state === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              )}
              role={state === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}

          <Button type="submit" className="w-full gap-2" disabled={state === "submitting"}>
            <Send aria-hidden className="h-4 w-4" />
            {state === "submitting" ? "Sending..." : "Send feedback"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
