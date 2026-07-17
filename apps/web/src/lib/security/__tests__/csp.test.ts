import { describe, expect, it } from "vitest";
import {
  buildSecurityHeaders,
  developmentCsp,
  getCspForPath,
  isSecurePath,
  publicCsp,
  secureCsp,
  shouldNoIndexPath
} from "@/lib/security/csp";

function headerValue(headers: { key: string; value: string }[], key: string) {
  return headers.find((header) => header.key === key)?.value;
}

describe("security CSP routing", () => {
  it("keeps content pages on the public policy", () => {
    expect(isSecurePath("/")).toBe(false);
    expect(isSecurePath("/catalog/free-roblox-items")).toBe(false);
    expect(getCspForPath("/catalog/free-roblox-items")).toBe(publicCsp);
    expect(shouldNoIndexPath("/catalog/free-roblox-items")).toBe(false);
  });

  it("uses the secure policy for auth and API routes", () => {
    expect(isSecurePath("/login")).toBe(true);
    expect(isSecurePath("/login/oauth")).toBe(true);
    expect(isSecurePath("/account")).toBe(true);
    expect(isSecurePath("/auth/roblox/login")).toBe(true);
    expect(isSecurePath("/api/comments/session")).toBe(true);
    expect(isSecurePath("/admin/dashboard")).toBe(true);
    expect(getCspForPath("/login")).toBe(secureCsp);
    expect(getCspForPath("/api/comments/session")).toBe(secureCsp);
  });

  it("adds noindex and deny framing to secure HTML routes", () => {
    const loginHeaders = buildSecurityHeaders("/login", "enforce");

    expect(headerValue(loginHeaders, "Content-Security-Policy")).toBe(secureCsp);
    expect(headerValue(loginHeaders, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(loginHeaders, "X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("keeps public pages indexable and framed only same-origin", () => {
    const homeHeaders = buildSecurityHeaders("/", "enforce");

    expect(headerValue(homeHeaders, "Content-Security-Policy")).toBe(publicCsp);
    expect(headerValue(homeHeaders, "X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headerValue(homeHeaders, "X-Robots-Tag")).toBeUndefined();
  });

  it("adds permissions policy and only sends HSTS when enabled", () => {
    const localHeaders = buildSecurityHeaders("/", "off", { enableHsts: false });
    const productionHeaders = buildSecurityHeaders("/", "off", { enableHsts: true });

    expect(headerValue(localHeaders, "Permissions-Policy")).toContain("camera=()");
    expect(headerValue(localHeaders, "Permissions-Policy")).toContain("microphone=()");
    expect(headerValue(localHeaders, "Strict-Transport-Security")).toBeUndefined();
    expect(headerValue(productionHeaders, "Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });

  it("can use the development image policy for local production previews", () => {
    const headers = buildSecurityHeaders("/", "enforce", {
      enableHsts: false,
      useDevelopmentCsp: true
    });

    expect(headerValue(headers, "Content-Security-Policy")).toBe(developmentCsp);
    expect(headerValue(headers, "Content-Security-Policy")).toContain("img-src 'self' data: blob: http: https:");
    expect(headerValue(headers, "Strict-Transport-Security")).toBeUndefined();
  });
});
