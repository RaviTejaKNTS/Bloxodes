import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, MessageCircle, SquareCheckBig, Trophy, UserCircle } from "lucide-react";
import { getCurrentAppUser } from "@/lib/auth/app-session";
import { sanitizeNextPath } from "@/lib/auth/navigation";
import { signOut } from "./actions";

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

type AuthPageProps = {
  searchParams?: Promise<{ error?: string | string[]; success?: string | string[]; next?: string | string[] }>;
};

const signInBenefits = [
  {
    icon: KeyRound,
    title: "Remember used codes",
    description: "Mark Roblox codes as used and keep that progress attached to your account."
  },
  {
    icon: SquareCheckBig,
    title: "Save checklist progress",
    description: "Continue game checklists from the same account instead of relying only on this browser."
  },
  {
    icon: Trophy,
    title: "Track quiz results",
    description: "Keep quiz completion and score history connected to your profile."
  },
  {
    icon: MessageCircle,
    title: "Join comments",
    description: "Use your Bloxodes profile when commenting on pages that support discussions."
  }
];

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const appUser = await getCurrentAppUser();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = Array.isArray(resolvedSearchParams?.error) ? resolvedSearchParams?.error[0] : resolvedSearchParams?.error ?? null;
  const successMessage = Array.isArray(resolvedSearchParams?.success) ? resolvedSearchParams?.success[0] : resolvedSearchParams?.success ?? null;
  const nextParam = Array.isArray(resolvedSearchParams?.next) ? resolvedSearchParams?.next[0] : resolvedSearchParams?.next ?? "";
  const nextPath = sanitizeNextPath(nextParam || null);
  const robloxLoginHref = nextPath ? `/auth/roblox/login?next=${encodeURIComponent(nextPath)}` : "/auth/roblox/login";

  const signedInName =
    appUser?.display_name ??
    appUser?.roblox_display_name ??
    appUser?.roblox_username ??
    (appUser ? `Roblox User ${appUser.roblox_user_id ?? ""}`.trim() : null);

  return (
    <div className="max-w-4xl space-y-10">
      <section className="space-y-7">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Login</p>
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Sign in with Roblox</h1>
          <p className="max-w-2xl text-base text-muted md:text-lg">
            Use Roblox sign-in to connect your Bloxodes profile, save progress, and keep your account details in one place.
          </p>
        </header>

        <div className="space-y-3">
          <Link
            href={robloxLoginHref}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Continue with Roblox
          </Link>
          <p className="max-w-xl text-xs leading-5 text-muted">
            We use Roblox&apos;s official sign-in flow. We never ask for your Roblox password.
          </p>
        </div>

        <p className="text-xs leading-5 text-muted">
          By continuing, you agree to our{" "}
          <Link href="/privacy-policy" className="text-foreground transition hover:text-accent">
            Privacy Policy
          </Link>
          .
        </p>

        {errorMessage ? (
          <p className="border-l-2 border-red-500/60 pl-3 text-sm text-red-300">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="border-l-2 border-emerald-500/60 pl-3 text-sm text-emerald-300">
            {successMessage}
          </p>
        ) : null}
      </section>

      <section className="space-y-5 border-t border-border/60 pt-8">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">What you get when you sign in</h2>
          <p className="text-base leading-7 text-muted">
            Bloxodes works without an account, but signing in makes progress and participation easier to keep track of.
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {signInBenefits.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-sm leading-6 text-muted">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {appUser ? (
        <section className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-8">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <UserCircle className="h-4 w-4" aria-hidden />
              Signed in as
            </p>
            <p className="text-xl font-semibold text-foreground">{signedInName ?? "Roblox user"}</p>
            {appUser.roblox_username ? <p className="text-xs text-muted">@{appUser.roblox_username}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-border/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
            >
              Account
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-border/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
              >
                Sign out
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
