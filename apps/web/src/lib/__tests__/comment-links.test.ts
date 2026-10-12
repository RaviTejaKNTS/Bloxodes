import { describe, expect, it } from "vitest";
import { detectCommentLink } from "@/lib/comment-links";

describe("comment link detection", () => {
  it.each([
    "https://example.com", "HTTP://EXAMPLE.COM/path", "ftp://files.example.com",
    "www.example.com", "www.", "<https://example.com>",
    "[click](https://example.com)", "![image](https://example.com/a.png)",
    "[click](/relative/path)", "[click](#anchor)", "[click][ref]", "[ref]: /relative/path",
    '<a href="/path">click</a>', '<IMG src="/a.png">', '<iframe src="/path"></iframe>',
    '<embed src="/path">', '<object data="/path">', '<video src="/a.mp4">',
    "example.com", "EXAMPLE.COM/path", "123.com", "...site.com", "(site.com)", "subdomain.roblox.com/share?code=abc",
    "share.roblox.com/abc", "roblox.com/share?code=abc&type=Server",
    "discord.gg/abc", "discord.com/invite/abc", "dsc.gg/abc",
    "bit.ly/abc", "tinyurl.com/abc", "t.co/abc", "goo.gl/abc", "is.gd/abc",
    "cutt.ly/abc", "rebrand.ly/abc", "tinyurl/abc",
    "site dot com", "site DOT COM/path", "site[.]com", "site(.)com",
    "site [ . ] com", "site ( . ) com", "site . com", "site, com/path",
    "site[dot]com", "site(dot)com", "site{dot}com", "site<dot>com",
    "site [ dot ] com", "site ( dot ) com", "site { dot } com", "site < dot > com", "site{.}com", "site<.>com",
    "discord. gg/abc", "discord . gg/abc", "discord[dot]gg/abc",
    "discord.gg", "discord. gg", "discord . gg", "discord[dot]gg", "discord,gg", "dsc,gg", "t,co",
    "_discord.gg/abc_", "*site.com*", "~site.com~", "`site.com`", "not_a_host.com",
    "site.game/path", "sub.site.game", "mysite.me/abc", "cool.gg/invite", "site,com/abc",
    "linktr.ee/x", "youtu.be/abc", "linktr. ee", "youtu. be", "site. com/path",
    "site.game?trade=1", "site.game#trade", "site,game?trade=1", "site,game#trade",
    "site.support/path", "site.work/path", "site.xn--p1ai/path", "a.co/path", "site.live/path",
    "sub.site.me", "sub.site.live", "sub.site.support", "good.Game.Best",
    "sub.host.game", "sub.host.me", "sub.host.live", "sub.host.support",
    "discord,com/invite/abc", "roblox,com/share?code=abc", "share.roblox,com/abc",
    "Thanks,site.com", "Nice. site.com", "Thanks,sub.site.game", "Nice. sub.site.game",
    "site。com", "site．com", "site｡com", "ｓｉｔｅ．ｃｏｍ", "site\u200b.com",
    "si\u200cte.co\u200dm", "site\u2060.com", "site\ufeff.com", "site\u034f.com",
    "site\ufe0f.com", "si\u{e0100}te.com", "site\t.\tcom",
    "site&#46;com", "site&#x2e;com", "site&period;com", "site&dot;com",
    "hxxp://example.com", "hxxps://example.com", "h t t p s :/ /example.com",
    "h t t p : / / localhost", "hxxp : / /localhost", "f t p : / / localhost",
    "Contact player@example.com", "player+trade@example.co.uk", "player @ example dot com",
    "player@localhost.invalid", "player@site。com", "buy@site[.]xyz",
    "my-shop.xyz", "site.co.uk", "site.com.Thanks",
    "例子.com", "site.zip", "site.mov", "site.gq"
  ])("blocks %s", (value) => {
    expect(detectCommentLink(value)).not.toBeNull();
  });

  it.each([
    "", "Great guide!", "Use **two seeds** and *wait*.", "@RobloxPlayer thanks!",
    "v1.2", "v1.2.3", "1.5x", "x2.5", "2.5M", "$1.99", "10.5k",
    "Got 2.5M cash and a 1.5x boost", "12:30", "1:05 p.m.", "10.30 am",
    "wait...ok", "Wait...Thanks!", "good.Thanks", "Great.Nice", "No.spaceshere",
    "Good. Game over.", "Nice. Online servers work.", "Nice, game looks good.", "Nice. gg",
    "I.am stuck", "Good.Game over", "thanks,gg", "update.It works", "wow.it is good",
    "Love this.Best guide", "gg.ez", "Nice.me too", "good game.gg", "GG. EZ",
    "site,com", "ok,info", "site. com", "site. game over", "Good.Game.Best", "123.456.game",
    "a.co", "site.live", "site.support", "site.work", "site.xn--p1ai",
    "site.notatld", "site,notatld", "yes,game", "ok,love it", "A dot appears on the map", "Connect the dots",
    "1,000 coins", "3.14159", "01.10.2026", "12/10/2026",
    "[trade] costs 100", "Craft (1) then upgrade [2]", "2 < 3 and 5 > 4",
    "<anything> is literal text", "[a] + (b)", "10...com",
    "-invalid.com", "invalid-.com", "h t t p is a protocol name",
    "tinyurl is a shortener", "discord invites aren't game codes", "Roblox share links exist"
  ])("allows %s", (value) => {
    expect(detectCommentLink(value)).toBeNull();
  });

  it.each("com net org io gg xyz co me ly app dev site online store shop link click top info biz ru cn tk ml ga cf us uk in to be fm tv cc ws".split(" "))(
    "blocks a hostname with the %s TLD", (tld) => {
      expect(detectCommentLink(`hostname.${tld}/path`)).toMatchObject({ reason: "domain" });
    }
  );

  it.each("com net org io xyz ly app dev site online store shop link click top info biz ru cn tk ml ga cf gq cc ws tv uk fm zip mov icu buzz vip club".split(" "))(
    "blocks a bare hostname with the high-signal %s TLD", (tld) => {
      expect(detectCommentLink(`hostname.${tld}`)).toMatchObject({ reason: "domain" });
    }
  );

  it.each("gg me us in to be is it so no at by do my am an as go co game games fun best love life cool free gold new now one win wow you how pet play help hot boo cat dog fish fan fans run lol live".split(" "))(
    "allows a bare hostname with the collision-prone %s suffix", (tld) => {
      expect(detectCommentLink(`hostname.${tld}`)).toBeNull();
    }
  );

  it("returns a match reason and has no state shared between calls", () => {
    expect(detectCommentLink("site.com")).toEqual({ reason: "domain", matched: "site.com" });
    expect(detectCommentLink("good.Thanks")).toBeNull();
    expect(detectCommentLink("site.com")).toEqual({ reason: "domain", matched: "site.com" });
    expect(detectCommentLink("me@site.com")).toMatchObject({ reason: "email" });
  });

  it("reports the host prefix before adjoining sentence text and preserves spaced-dot matches", () => {
    expect(detectCommentLink("site.com.Thanks")).toEqual({ reason: "domain", matched: "site.com" });
    expect(detectCommentLink("discord. gg/abc")).toEqual({ reason: "domain", matched: "discord. gg" });
  });
});
