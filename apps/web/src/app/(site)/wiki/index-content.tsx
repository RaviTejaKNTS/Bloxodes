import Link from "next/link";
import { Gamepad2, Users, Shirt, Trophy, Coins, Blocks } from "lucide-react";
import type { ReactNode } from "react";

export const WIKI_INDEX_TITLE = "Roblox Wiki: Games, Gameplay, Items and Platform Stats";
export const WIKI_INDEX_DESCRIPTION = "Explore the Roblox wiki: game guides, item collections, servers, controls, avatars, badges, Robux, and player activity across games tracked by Bloxodes.";

export const wikiTopics = [
  { id: "games-and-places", title: "Games and worlds", icon: Gamepad2, links: [{ label: "Game wikis", href: "#game-wikis" }, { label: "Experiences and places", href: "#games-and-places" }, { label: "Genres", href: "#roblox-genres" }] },
  { id: "controls", title: "Playing together", icon: Users, links: [{ label: "Controls", href: "#controls" }, { label: "Servers", href: "#servers" }, { label: "Multiplayer", href: "#servers" }] },
  { id: "avatars", title: "Avatars and items", icon: Shirt, links: [{ label: "R6 and R15", href: "#avatars" }, { label: "Clothing and accessories", href: "/catalog/roblox-items-and-bundles" }, { label: "Free items", href: "/catalog/free-roblox-items" }] },
  { id: "badges-and-progression", title: "Rewards and progress", icon: Trophy, links: [{ label: "Badges", href: "#badges-and-progression" }, { label: "Game codes", href: "/codes" }, { label: "Collections", href: "#game-collections" }] },
  { id: "robux-and-purchases", title: "Robux and purchases", icon: Coins, links: [{ label: "Robux", href: "#robux-and-purchases" }, { label: "Passes", href: "#robux-and-purchases" }, { label: "Developer products", href: "#robux-and-purchases" }] },
  { id: "creators-and-history", title: "Creators and community", icon: Blocks, links: [{ label: "Roblox Studio", href: "#creators-and-history" }, { label: "Events", href: "#roblox-events" }, { label: "Dictionary", href: "/catalog/roblox-dictionary" }] }
];

function ReferenceSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="space-y-4 border-t border-border/60 pt-7">
    <h2 id={id} className="scroll-mt-24 text-2xl font-semibold leading-tight text-foreground md:text-3xl">{title}</h2>
    {children}
  </section>;
}

function Source({ href, children }: { href: string; children: ReactNode }) {
  return <p className="text-sm text-muted">Reference: <a href={href} className="underline underline-offset-4 hover:text-accent">{children}</a></p>;
}

function ReferenceTable({ caption, headings, rows }: { caption: string; headings: string[]; rows: string[][] }) {
  return <div className="overflow-x-auto rounded-lg border border-border/70">
    <table className="w-full text-left text-sm leading-6">
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-surface-muted/60"><tr>{headings.map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-semibold text-foreground">{heading}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row[0]} className="border-t border-border/60">{row.map((cell, index) => index === 0 ? <th key={index} scope="row" className="w-1/4 px-4 py-3 align-top font-medium text-foreground">{cell}</th> : <td key={index} className="px-4 py-3 align-top text-foreground/85">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

export function WikiReference() {
  return <div className="min-w-0 space-y-9 text-[1.05rem] leading-relaxed text-foreground/90 [&_p]:max-w-3xl">
    <ReferenceSection id="games-and-places" title="Experiences, places, and game worlds">
      <p>A Roblox experience is a game or interactive world created on the platform. An experience can contain one place or several: a starting area, a dungeon, and a separate match map can all belong to the same game. Each place contains its own world and game logic.</p>
      <ReferenceTable caption="Roblox game structure" headings={["Term", "Meaning in Roblox"]} rows={[
        ["Experience / game", "The overall project players discover and join. It can bring together multiple places."],
        ["Place", "An individual environment within an experience. The start place is the normal entry point."],
        ["Server", "A running session of a place, shared by the players connected to it."],
        ["Universe ID / Place ID", "Separate identifiers for the overall experience and an individual place. They are not interchangeable."]
      ]} />
      <p>Moving to another map does not always mean joining a different game. Developers can teleport players between places within one experience. Progress, matchmaking, and access to areas depend on that experience’s design.</p>
      <p className="text-base"><Link href="/tools/roblox-id-extractor" className="text-accent underline underline-offset-4">Find a game’s Roblox IDs</Link></p>
      <Source href="https://create.roblox.com/docs/production/publishing/publish-games-and-places">Roblox: games and places</Source>
    </ReferenceSection>

    <ReferenceSection id="roblox-genres" title="Roblox game genres">
      <p>Genre describes a game’s main style of play. A game can combine several systems: an RPG may include crafting and trading, while a simulator may add combat or collection goals. These are useful starting points when choosing a wiki.</p>
      <ReferenceTable caption="Common Roblox gameplay styles" headings={["Style", "Typical gameplay", "Useful wiki references"]} rows={[
        ["RPG", "Character progression, quests, combat, and equipment.", "Classes, builds, weapons, enemies, and quest requirements."],
        ["Simulation and tycoon", "Gathering resources, upgrading production, or managing a business.", "Upgrade costs, equipment, production chains, and collectibles."],
        ["Obby and platformer", "Movement challenges, jumps, checkpoints, and timed courses.", "Controls, routes, checkpoints, and movement mechanics."],
        ["Roleplay", "Social play and player-created roles in a shared setting.", "Locations, jobs, homes, vehicles, and customization."],
        ["Survival and horror", "Surviving threats or completing objectives under pressure.", "Enemies, items, maps, encounters, and survival mechanics."],
        ["Shooter and action", "Aiming, combat, matches, or character abilities.", "Weapons, abilities, maps, modes, and equipment."],
        ["Strategy and tower defense", "Planning a team or defense against opponents and waves.", "Units, placement, upgrades, synergies, and enemy types."]
      ]} />
      <p className="text-base"><Link href="/stats/games" className="text-accent underline underline-offset-4">Compare games by genre and player activity</Link></p>
    </ReferenceSection>

    <ReferenceSection id="controls" title="Controls, camera, and inventory">
      <p>Roblox supplies a character controller, but developers can replace it or add actions. A fishing game, vehicle simulator, and fighting game will have different interaction prompts even on the same device.</p>
      <ReferenceTable caption="Roblox controls by device" headings={["Device", "Movement and camera", "Game actions"]} rows={[
        ["Keyboard and mouse", "Common character controls use W, A, S, D to move, Space to jump, and the mouse to control the camera.", "Use the on-screen key prompts. Combat, sprinting, interaction, and inventory shortcuts vary by game."],
        ["Touchscreen", "Movement and camera use touch controls. Their placement can depend on the selected control mode.", "Tap the game’s action buttons. Some games use gestures or a custom interface."],
        ["Controller", "Supported games generally use the sticks for movement and camera control.", "Follow the controller button prompts. Check that the experience supports your device."]
      ]} />
      <p>The backpack or hotbar can hold equippable tools. Many games also have their own inventory for pets, resources, weapons, or quest items. An item in a game inventory is not automatically an avatar item you can wear elsewhere on Roblox.</p>
      <Source href="https://create.roblox.com/docs/input">Roblox input systems</Source>
    </ReferenceSection>

    <ReferenceSection id="servers" title="Servers and multiplayer">
      <p>A server is one running session of a game world. Popular experiences have many sessions at the same time, so two players can join the same game without entering the same server.</p>
      <ReferenceTable caption="Public and private Roblox servers" headings={["Server type", "How players join"]} rows={[
        ["Public", "Players join through the experience or an available server. Capacity, account settings, and the game’s matchmaking affect entry."],
        ["Private", "The owner controls access through the available server settings. Developers decide whether private servers are offered and whether they are free or paid."],
        ["Reserved", "A developer-controlled session often used for a match, party, or dungeon. The game transfers eligible players into it."]
      ]} />
      <p>Private server access does not promise special drops or faster progress. Those rules belong to the game. Joining other players and using communication features also depend on account eligibility, privacy settings, and available space.</p>
      <Source href="https://create.roblox.com/docs/production/monetization/private-servers">Roblox private servers</Source>
      <Source href="https://create.roblox.com/docs/projects/teleport">Roblox teleporting and reserved servers</Source>
    </ReferenceSection>

    <ReferenceSection id="badges-and-progression" title="Badges, rewards, and progression">
      <p>Badges record achievements awarded by an experience. A developer might award one for joining, finishing a quest, finding a secret, or completing a difficult challenge. A badge’s conditions are specific to the game that awards it.</p>
      <p>Levels, coins, pets, bestiaries, and quest logs are usually game-specific progression systems. Their rewards, saving rules, and reset behavior are controlled by the developer. A seasonal reset in one game has no universal meaning for other Roblox experiences.</p>
      <p>Game codes are another developer-controlled reward system. They can provide items, boosts, or game currency, with redemption requirements and expiry decided by the game. They are separate from platform promo codes and gift cards.</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-base"><Link href="/codes" className="text-accent underline underline-offset-4">Game codes</Link><Link href="/checklists" className="text-accent underline underline-offset-4">Progress checklists</Link><Link href="/catalog/roblox-promo-codes" className="text-accent underline underline-offset-4">Platform promo rewards</Link></div>
      <Source href="https://create.roblox.com/docs/production/publishing/badges">Roblox badges</Source>
    </ReferenceSection>

    <ReferenceSection id="avatars" title="Avatars, clothing, and accessories">
      <p>Your Roblox avatar represents you across the platform. Its appearance combines a body, clothing, accessories, and animations. Experiences can use your chosen avatar, standardize its size and movement, or substitute a custom character.</p>
      <ReferenceTable caption="Roblox avatar systems" headings={["System", "What it controls"]} rows={[
        ["R6 and R15", "Character rig types. R6 is the legacy six-part body; R15 uses fifteen body parts for a more articulated character. Game settings determine the supported setup."],
        ["Classic clothing", "2D clothing textures applied to the character’s body."],
        ["Layered clothing", "3D clothing designed to fit over compatible avatar bodies."],
        ["Accessories and animations", "Wearable objects and character movements. Compatibility can depend on the avatar and the experience."]
      ]} />
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-base"><Link href="/catalog/roblox-items-and-bundles" className="text-accent underline underline-offset-4">Items and bundles</Link><Link href="/catalog/free-roblox-items" className="text-accent underline underline-offset-4">Free avatar items</Link></div>
      <Source href="https://create.roblox.com/docs/avatar">Roblox avatar system</Source>
      <Source href="https://create.roblox.com/docs/studio/avatar-settings">Roblox avatar settings</Source>
    </ReferenceSection>

    <ReferenceSection id="robux-and-purchases" title="Robux, passes, and game purchases">
      <p>Robux is Roblox’s virtual currency. It is distinct from a game’s earned coins or gems. Purchases can unlock avatar items, experience access, or benefits inside a particular game; the purchase type determines what the player receives.</p>
      <ReferenceTable caption="Types of Roblox purchases" headings={["Purchase", "How it works", "Example"]} rows={[
        ["Pass", "A one-time purchase granting a defined privilege in an experience.", "Access to a special area or a permanent ability."],
        ["Developer product", "A purchase that can be made repeatedly.", "A pack of game currency, a potion, or a consumable revive."],
        ["Experience subscription", "Recurring payment for benefits while the subscription is active.", "A game’s monthly membership benefits."],
        ["Avatar item", "An item for the platform’s avatar customization system, subject to compatibility.", "Clothing, an accessory, or an animation."],
        ["Paid private server", "Recurring Robux payment for private server access when a developer offers it.", "A private session for a group of friends."]
      ]} />
      <p>Always read the item or benefit description before purchasing. A pass in one experience does not grant the equivalent benefit in another.</p>
      <p className="text-base"><Link href="/tools/robux-to-usd-calculator" className="text-accent underline underline-offset-4">Robux purchase calculator</Link></p>
      <Source href="https://create.roblox.com/docs/production/monetization">Roblox monetization reference</Source>
    </ReferenceSection>

    <ReferenceSection id="creators-and-history" title="Roblox Studio, creators, and community">
      <p>Roblox Corporation operates the platform, while individual creators and teams build its games. Roblox Studio is the creation application: developers assemble environments, build interfaces, and use Luau scripts to define game behavior.</p>
      <p>Roblox launched publicly in 2006. Its catalog of creator-built games has grown alongside its creation tools and avatar systems. A game’s creation date, public release, and latest update can be different dates; a metadata update alone does not describe what changed in gameplay.</p>
      <p>Developer communities are often where players find update announcements, event details, and game-specific discussions. Follow the official links on a game’s wiki or Roblox page to identify the creator behind it.</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-base"><a href="https://create.roblox.com/docs/studio" className="text-accent underline underline-offset-4">Roblox Studio</a><Link href="/stats/creators" className="text-accent underline underline-offset-4">Creator stats</Link><Link href="/catalog/roblox-dictionary" className="text-accent underline underline-offset-4">Roblox dictionary</Link></div>
      <Source href="https://en.wikipedia.org/wiki/Roblox">Roblox platform history</Source>
    </ReferenceSection>
  </div>;
}
