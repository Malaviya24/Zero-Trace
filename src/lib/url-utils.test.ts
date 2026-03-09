import { describe, expect, it } from "vitest";
import { extractUrlsFromText, firstUrlFromText, normalizeUserUrl, segmentTextWithLinks } from "./url-utils";

describe("url-utils", () => {
  it("normalizes www urls with https", () => {
    expect(normalizeUserUrl("www.example.com/path")).toBe("https://www.example.com/path");
  });

  it("extracts unique urls in order", () => {
    const urls = extractUrlsFromText("Visit https://example.com and www.example.com and https://example.com");
    expect(urls).toEqual(["https://example.com/", "https://www.example.com/"]);
  });

  it("returns first url or null", () => {
    expect(firstUrlFromText("text only")).toBeNull();
    expect(firstUrlFromText("read https://example.com now")).toBe("https://example.com/");
  });

  it("segments text into link and non-link chunks", () => {
    const segments = segmentTextWithLinks("Hello https://example.com world");
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({ type: "text", value: "Hello " });
    expect(segments[1]).toMatchObject({ type: "link", href: "https://example.com/" });
    expect(segments[2]).toEqual({ type: "text", value: " world" });
  });
});
