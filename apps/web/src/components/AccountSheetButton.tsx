"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogIn, LogOut, ShieldCheck, User } from "lucide-react";
import { signOut } from "@/app/(secure)/login/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { type SidebarAccount } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

type AccountSheetButtonProps = {
  account: SidebarAccount;
  className?: string;
};

function getAccountName(account: SidebarAccount) {
  return account.signedIn ? account.label : "Account";
}

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

export function AccountSheetButton({ account, className }: AccountSheetButtonProps) {
  const pathname = usePathname() ?? "/";
  const [returnPath, setReturnPath] = useState(pathname);
  const [open, setOpen] = useState(false);
  const [displayAccount, setDisplayAccount] = useState(account);

  const refreshAccount = useCallback(async () => {
    try {
      const response = await fetch("/api/account/avatar", {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) return;

      const payload = (await response.json()) as {
        avatarUrl?: string | null;
        displayName?: string | null;
        signedIn?: boolean;
      };

      if (!payload.signedIn) {
        setDisplayAccount(account);
        return;
      }

      setDisplayAccount({
        avatarUrl: payload.avatarUrl ?? null,
        href: "/account",
        label: payload.displayName?.trim() || "Account",
        signedIn: true
      });
    } catch {
      setDisplayAccount(account);
    }
  }, [account]);

  useEffect(() => {
    setReturnPath(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);

  useEffect(() => {
    if (open) void refreshAccount();
  }, [open, refreshAccount]);

  const loginHref = `/auth/roblox/login?next=${encodeURIComponent(returnPath)}&source=${encodeURIComponent(returnPath)}`;
  const accountName = getAccountName(displayAccount);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            displayAccount.avatarUrl ? "p-0" : "",
            className
          )}
          aria-label={displayAccount.signedIn ? `Open account for ${accountName}` : "Open account sign in"}
          title={displayAccount.signedIn ? `Account: ${accountName}` : "Sign in"}
        >
          <AccountIcon account={displayAccount} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(24rem,_92vw)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{displayAccount.signedIn ? "Account" : "Sign in"}</SheetTitle>
          <SheetDescription>
            {displayAccount.signedIn
              ? "Your Bloxodes account is connected through Roblox."
              : "Use Roblox sign-in to save progress and keep account actions in one place."}
          </SheetDescription>
        </SheetHeader>

        {displayAccount.signedIn ? (
          <div className="mt-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-border/60 pb-5">
              {displayAccount.avatarUrl ? (
                <Image
                  src={displayAccount.avatarUrl}
                  alt={accountName}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full border border-border/70 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground">
                  <User aria-hidden className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{accountName}</p>
                <p className="text-xs text-muted">Signed in with Roblox</p>
              </div>
            </div>

            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/account" onClick={() => setOpen(false)}>
                  Account settings
                  <ExternalLink aria-hidden className="h-4 w-4" />
                </Link>
              </Button>
              <form action={signOut}>
                <Button type="submit" variant="ghost" className="w-full justify-start text-muted-foreground">
                  <LogOut aria-hidden className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="space-y-3 border-b border-border/60 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground">
                <ShieldCheck aria-hidden className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Roblox-only login</p>
                <p className="text-sm leading-6 text-muted">
                  We send you through Roblox&apos;s official OAuth flow and return you to this page.
                </p>
              </div>
            </div>

            <Button asChild className="w-full">
              <Link href={loginHref}>
                <LogIn aria-hidden className="h-4 w-4" />
                Continue with Roblox
              </Link>
            </Button>

            <p className="text-xs leading-5 text-muted">
              We never ask for your Roblox password. By continuing, you agree to the{" "}
              <Link href="/privacy-policy" className="text-foreground hover:text-accent">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
