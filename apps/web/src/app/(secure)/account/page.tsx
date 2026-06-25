import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { getCurrentAppUser } from "@/lib/auth/app-session";
import { cn } from "@/lib/utils";
import { signOut } from "../login/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  }
};

const ACCOUNT_PATH = "/account";

type AccountPageProps = {
  searchParams?: Promise<{ error?: string | string[]; success?: string | string[] }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect(`/login?next=${encodeURIComponent(ACCOUNT_PATH)}`);
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error ?? null;
  const successMessage = Array.isArray(resolvedSearchParams?.success)
    ? resolvedSearchParams?.success[0]
    : resolvedSearchParams?.success ?? null;

  const displayName = appUser.display_name ?? appUser.roblox_display_name ?? appUser.roblox_username ?? "Roblox user";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Account</p>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground md:text-4xl">Your Bloxodes account</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          Manage the Roblox profile connected to Bloxodes. Progress, comments, and account actions use this identity.
        </p>
      </header>

      {errorMessage || successMessage ? (
        <div
          className={cn(
            "border px-4 py-3 text-sm",
            errorMessage ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          )}
        >
          {errorMessage ?? successMessage}
        </div>
      ) : null}

      <section className="border border-border/60 bg-surface">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            {appUser.roblox_avatar_url ? (
              <Image
                src={appUser.roblox_avatar_url}
                alt={displayName}
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-full border border-border/60 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-border/60 bg-background/70 text-muted">
                <UserRound className="h-6 w-6" aria-hidden />
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-lg font-semibold text-foreground">{displayName}</p>
                {appUser.role === "admin" ? (
                  <span className="inline-flex items-center gap-1 border border-amber-400/50 bg-amber-500/10 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-300">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    Admin
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted">
                {appUser.roblox_username ? `@${appUser.roblox_username}` : "Username unavailable"}
              </p>
              <p className="text-xs text-muted">
                {appUser.roblox_user_id ? `Roblox ID: ${appUser.roblox_user_id}` : "Roblox ID unavailable"}
              </p>
            </div>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-2 border border-border/70 px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>

        {appUser.roblox_profile_url ? (
          <div className="border-t border-border/60 p-5 sm:p-6">
            <Link
              href={appUser.roblox_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-2 border border-border/70 px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
            >
              Open Roblox profile
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
