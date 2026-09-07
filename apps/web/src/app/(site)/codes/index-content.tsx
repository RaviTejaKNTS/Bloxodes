import Link from "next/link";
import type { IndexGuideSection } from "../index-guide";

export const CODES_INDEX_DESCRIPTION =
  "Find Roblox game codes by game, with reward lists and redemption instructions. Learn how codes work, why they expire, and what to check when redemption fails.";

export const codesGuideSections: IndexGuideSection[] = [
  {
    id: "about-roblox-codes",
    label: "About game codes",
    title: "What are Roblox game codes?",
    content: <>
      <p data-md-copy>Roblox game codes are rewards released by an experience’s developer. Depending on the game, a code might give you coins, gems, spins, an experience boost, or a cosmetic item. The developer decides the reward, any requirements, and when the code stops working.</p>
      <p data-md-copy>Start with the game you play. Each Bloxodes codes page brings together its listed active codes, rewards, expired codes, and game-specific redemption instructions. The active-code count on a card helps you see whether that game has any rewards listed before opening it.</p>
      <p data-md-copy>Game codes belong to individual experiences. A code for one game will not automatically work in another, and some games do not have a code system at all.</p>
    </>
  },
  {
    id: "redeem-game-codes",
    label: "How to redeem",
    title: "How to redeem Roblox game codes",
    content: <>
      <p data-md-copy>The exact menu depends on the game. Open its codes page for the specific steps, then follow this general process:</p>
      <ol data-md-copy>
        <li data-md-copy>Launch the correct experience on Roblox. Check the game and developer if several experiences have similar names.</li>
        <li data-md-copy>Complete any requirements mentioned in the guide, such as a tutorial or a minimum level.</li>
        <li data-md-copy>Find the game’s redemption menu. It may be under Codes, Settings, Shop, or a gift icon.</li>
        <li data-md-copy>Copy the code exactly, remove any extra spaces, and confirm with the game’s redeem button.</li>
        <li data-md-copy>Check the confirmation message and your inventory or currency balance for the reward.</li>
      </ol>
      <p data-md-copy>Read the reward description before claiming a timed boost: in some games, its timer begins immediately.</p>
    </>
  },
  {
    id: "codes-not-working",
    label: "Codes not working?",
    title: "Why is my Roblox code not working?",
    content: <>
      <p data-md-copy>The message shown by the game is the best starting point. Check these common causes before trying the code again:</p>
      <ul data-md-copy>
        <li data-md-copy><strong data-md-copy>Expired:</strong> the developer may have disabled the code since it was listed. There is no single expiry schedule across Roblox games.</li>
        <li data-md-copy><strong data-md-copy>Already redeemed:</strong> the reward may already have been claimed on your account.</li>
        <li data-md-copy><strong data-md-copy>Invalid entry:</strong> check capitalization, punctuation, and spaces against the listed code.</li>
        <li data-md-copy><strong data-md-copy>Requirements not met:</strong> the game may require progress, group membership, or another condition before redemption.</li>
        <li data-md-copy><strong data-md-copy>Wrong game:</strong> check that you launched the experience the code was released for.</li>
      </ul>
      <p data-md-copy>If a newly released code still fails, check the developer’s announcements for instructions or known issues. A listed active status is a useful lead, but the game’s redemption result determines whether you can claim it.</p>
    </>
  },
  {
    id: "game-codes-and-promo-codes",
    label: "Game codes vs. promo codes",
    title: "Game codes, Roblox promo codes, and gift cards",
    content: <>
      <p data-md-copy>This directory covers codes for individual games. Platform promo codes and gift cards have a different redemption process. Roblox’s <a data-md-copy href="https://www.roblox.com/redeem">official redemption page</a> accepts supported gift card, virtual item, and promo codes; an in-game reward code usually belongs in that experience’s own menu.</p>
      <p data-md-copy>For platform rewards, visit our <Link data-md-copy href="/catalog/roblox-promo-codes">Roblox promo codes and reward items</Link> reference. For avatar items available without a purchase, explore <Link data-md-copy href="/catalog/free-roblox-items">free Roblox items</Link>. Game currency and boosts should not be confused with Robux.</p>
    </>
  },
  {
    id: "finding-new-codes",
    label: "Finding new codes",
    title: "Where new codes come from",
    content: <>
      <p data-md-copy>Developers may announce codes in their game description, official community channels, or update posts. Our game pages include source and social links where available, so you can follow the experience’s own announcements.</p>
      <p data-md-copy>Bloxodes refreshes code lists from published sources and separates listed active codes from expired ones. This does not mean every code has been personally redeemed in-game. A page update also does not necessarily mean a new code was added.</p>
      <p data-md-copy>Need help beyond rewards? Open the <Link data-md-copy href="/wiki">Roblox wiki</Link> for game guides, controls, tips, and item collections, or read our <Link data-md-copy href="/editorial-guidelines">editorial guidelines</Link> to learn more about how Bloxodes handles content.</p>
    </>
  }
];
