"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { type SidebarAccount } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

type SiteHeaderActionsProps = {
  account: SidebarAccount;
  className?: string;
};

function AccountIcon({ account }: { account: SidebarAccount }) {
  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        aria-hidden="true"
        className="h-7 w-7 rounded-full border border-border/70 object-cover"
        loading="lazy"
      />
    );
  }

  return <User aria-hidden className="h-4 w-4" />;
}

export function SiteHeaderActions({ account, className }: SiteHeaderActionsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Link
        href={account.href}
        aria-label={account.label}
        title={account.label}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <AccountIcon account={account} />
      </Link>
      <ThemeToggle className="h-9 w-9 rounded-md border-transparent bg-transparent text-muted-foreground shadow-none hover:translate-y-0 hover:bg-muted/60 hover:text-foreground [&_svg]:h-4 [&_svg]:w-4" />
    </div>
  );
}
