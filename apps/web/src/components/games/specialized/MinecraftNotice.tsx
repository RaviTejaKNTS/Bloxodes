import Link from "next/link";

// Required on every Minecraft page (previously the /minecraft route layout).
export function MinecraftNotice() {
  return (
    <p className="mt-12 border-t border-border pt-4 text-sm leading-6 text-muted">
      Unofficial Minecraft website. Bloxodes is not approved by or associated with Mojang or Microsoft. <Link href="/contact" className="underline underline-offset-4">Contact Bloxodes</Link> about this website.
    </p>
  );
}
