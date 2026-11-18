import { describe, expect, it } from "vitest";
import { find1688Url, is1688Url } from "@/lib/agent/product-url";

describe("1688 URL detection", () => {
  it("finds desktop detail links and strips trailing Chinese punctuation", () => {
    expect(find1688Url("帮我抓取 https://detail.1688.com/offer/889897473488.html，谢谢")).toBe(
      "https://detail.1688.com/offer/889897473488.html",
    );
  });

  it("accepts bare links and mobile links", () => {
    expect(find1688Url("detail.1688.com/offer/889897473488.html")).toContain("detail.1688.com/offer/889897473488.html");
    expect(find1688Url("https://m.1688.com/offer/889897473488.html?spm=1")).toContain("m.1688.com/offer/889897473488.html");
  });

  it("keeps query parameters and rejects other hosts", () => {
    expect(find1688Url("https://detail.1688.com/offer/1.html?spm=a.b")).toContain("spm=a.b");
    expect(find1688Url("https://example.com/offer/1.html")).toBeNull();
    expect(is1688Url("看看这个 https://example.com/x")).toBe(false);
  });
});
