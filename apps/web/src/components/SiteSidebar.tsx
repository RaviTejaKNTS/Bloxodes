import Link from "next/link";
import { User } from "lucide-react";
import { SidebarActiveState } from "@/components/SidebarActiveState";
import { SidebarSearch } from "@/components/SidebarSearch";
import { SiteLogo } from "@/components/SiteLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isNavLinkActive, siteNavLinks, type SidebarAccount } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

type SiteSidebarProps = {
  account: SidebarAccount;
  pathname: string;
};

const DESKTOP_NAV_ID = "site-sidebar-primary-nav";

function AccountIcon({ account }: { account: SidebarAccount }) {
  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        aria-hidden="true"
        className="h-[26px] w-[26px] rounded-full border border-sidebar-border object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground/70">
      <User aria-hidden className="h-4 w-4" />
    </span>
  );
}

export function SiteSidebar({ account, pathname }: SiteSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[15.5rem] flex-col border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-none xl:flex">
      <div className="px-3 pb-2 pt-5">
        <div className="flex min-h-11 items-center justify-center">
          <SiteLogo className="h-10" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <SidebarSearch className="px-1 pb-3" initialPathname={pathname} />

        <nav id={DESKTOP_NAV_ID} className="px-1" aria-label="Primary">
          <div className="h-6 px-2 text-[11px] font-medium uppercase leading-6 tracking-[0.12em] text-sidebar-foreground/40">
            Browse
          </div>
          <ul className="space-y-1">
            {siteNavLinks.map((link) => {
              const active = isNavLinkActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    data-site-nav-link
                    data-href={link.href}
                    data-active={active ? "true" : "false"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold text-sidebar-foreground/68 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent/85 data-[active=true]:text-sidebar-foreground",
                      "[&>svg]:h-[18px] [&>svg]:w-[18px]"
                    )}
                  >
                    <link.icon aria-hidden className="h-3.5 w-3.5" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mx-3 my-2 h-px bg-sidebar-border" />

        <div className="px-1">
          <Link
            href={account.href}
            aria-label={account.label}
            title={account.label}
            className="flex h-9 w-full items-center justify-start gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <AccountIcon account={account} />
            <span className="min-w-0 truncate">{account.signedIn ? account.label : "Sign in"}</span>
          </Link>
          <div className="flex h-9 items-center justify-between gap-2 rounded-lg px-2.5 hover:bg-sidebar-accent">
            <span className="text-[13px] font-semibold text-sidebar-foreground/70">Theme</span>
            <ThemeToggle className="h-[26px] w-[26px] border-sidebar-border bg-transparent shadow-none hover:translate-y-0 hover:bg-sidebar-accent [&_svg]:h-3.5 [&_svg]:w-3.5" />
          </div>
        </div>
      </div>

      <SidebarActiveState navId={DESKTOP_NAV_ID} />
    </aside>
  );
}
