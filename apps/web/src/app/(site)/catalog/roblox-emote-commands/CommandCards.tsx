import { CopyCodeButton } from "@/components/CopyCodeButton";
import type { RobloxEmoteCommand } from "@/lib/roblox-emote-commands";

export function CommandCards({ commands }: { commands: RobloxEmoteCommand[] }) {
  return (
    <section aria-labelledby="default-emote-commands" className="space-y-4">
      <h2 id="default-emote-commands">Default Roblox emote commands</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-journey-list>
        {commands.map((entry) => (
          <article
            key={entry.code}
            id={entry.code}
            data-journey-item
            className="flex h-full flex-col rounded-lg border border-border/70 bg-surface p-4 transition-colors hover:border-accent/55 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-lg font-semibold text-foreground">{entry.name}</h3>
              <CopyCodeButton
                code={entry.command}
                size="sm"
                analytics={{
                  event: "emote_command_copy",
                  params: { command: entry.command, kind: entry.kind }
                }}
              />
            </div>
            <code className="mt-3 w-fit rounded-md border border-border/60 bg-background/50 px-2.5 py-1.5 text-sm font-semibold text-foreground">
              {entry.command}
            </code>
            <p className="mb-0 mt-3 text-sm leading-6 text-muted">{entry.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
