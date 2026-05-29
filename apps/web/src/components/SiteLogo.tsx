import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function SiteLogo({ className = "h-9" }: { className?: string }) {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Bloxodes home">
      <Image
        src="/Bloxodes-dark.png"
        alt="Bloxodes"
        width={948}
        height={319}
        priority
        className={cn("hidden w-auto shrink-0 dark:block", className)}
      />
      <Image
        src="/Bloxodes-light.png"
        alt="Bloxodes"
        width={948}
        height={319}
        loading="lazy"
        fetchPriority="low"
        className={cn("block w-auto shrink-0 dark:hidden", className)}
      />
    </Link>
  );
}
