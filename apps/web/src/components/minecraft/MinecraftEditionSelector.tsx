import { buttonVariants } from "@/components/ui/button";
import { minecraftEditionHref, minecraftEditionLabel, type MinecraftEdition } from "@/lib/minecraft-edition";

export function MinecraftEditionSelector({
  edition,
  basePath,
  searchParams,
  label = "Choose your edition"
}: {
  edition: MinecraftEdition;
  basePath: string;
  searchParams?: Record<string, string | string[] | undefined>;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <nav aria-label="Minecraft edition" className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface-muted p-1">
        {(["java", "bedrock"] as const).map(value => (
          <a
            key={value}
            href={minecraftEditionHref(basePath, value, searchParams)}
            aria-current={edition === value ? "page" : undefined}
            className={buttonVariants({ variant: edition === value ? "outline" : "ghost", className: "min-h-11 px-4" })}
          >
            {minecraftEditionLabel(value)}
          </a>
        ))}
      </nav>
    </div>
  );
}
