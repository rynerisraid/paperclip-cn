import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { shouldServeStaticUiHtml, shouldServeViteDevHtml } from "../app.js";

function createRequest(path: string, acceptsResult: string | false, method = "GET"): Request {
  return {
    method,
    path,
    accepts: () => acceptsResult,
  } as unknown as Request;
}

describe("shouldServeViteDevHtml", () => {
  it("serves HTML shell for document requests", () => {
    expect(shouldServeViteDevHtml(createRequest("/", "html"))).toBe(true);
    expect(shouldServeViteDevHtml(createRequest("/issues/abc", "html"))).toBe(true);
  });

  it("skips public assets even when the client accepts */*", () => {
    expect(shouldServeViteDevHtml(createRequest("/sw.js", "html"))).toBe(false);
    expect(shouldServeViteDevHtml(createRequest("/site.webmanifest", "html"))).toBe(false);
  });

  it("skips vite asset requests", () => {
    expect(shouldServeViteDevHtml(createRequest("/@vite/client", "html"))).toBe(false);
    expect(shouldServeViteDevHtml(createRequest("/src/main.tsx", "html"))).toBe(false);
  });
});

describe("shouldServeStaticUiHtml", () => {
  it("keeps both HTML entrypoints on the locale-aware path", () => {
    expect(shouldServeStaticUiHtml(createRequest("/", "html"))).toBe(true);
    expect(shouldServeStaticUiHtml(createRequest("/index.html", "html"))).toBe(true);
  });

  it("ignores other routes and non-document methods", () => {
    expect(shouldServeStaticUiHtml(createRequest("/issues/PAP-1", "html"))).toBe(false);
    expect(shouldServeStaticUiHtml(createRequest("/index.html", "html", "POST"))).toBe(false);
  });
});
