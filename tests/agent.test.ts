import { describe, expect, it } from "vitest";
import { classifyAgentIntent, detectCountries, detectCountry, parseSupplierPrice } from "@/lib/agent/intent";

describe("agent intent routing", () => {
  it("routes a four-market comparison to research/market views", () => {
    expect(classifyAgentIntent("比较美国、日本、德国和英国，哪个市场最值得先验证？")).toBe("MARKETS");
    expect(classifyAgentIntent("英国和德国对比")).toBe("MARKETS");
    expect(classifyAgentIntent("把日本发布页的标题改短一点")).toBe("LAUNCH");
    expect(detectCountries("比较美国、日本、德国和英国")).toEqual(["US", "JP", "DE", "UK"]);
  });

  it("routes a country compliance question", () => {
    expect(classifyAgentIntent("德国有哪些合规要求？")).toBe("COMPLIANCE");
    expect(detectCountry("德国有哪些合规要求？")).toBe("DE");
  });

  it("extracts a supplier price scenario without treating years as prices", () => {
    expect(parseSupplierPrice("采购价降到20元会怎样？")).toBe(20);
    expect(parseSupplierPrice("把成本改成 18.5 元")).toBe(18.5);
    expect(parseSupplierPrice("便携式充电风扇，采购单价25元，想进入墨西哥 Mercado Libre。")).toBe(25);
    expect(parseSupplierPrice("研究 2026 年美国市场")).toBeNull();
  });

  it("routes launch and passport requests explicitly", () => {
    expect(classifyAgentIntent("帮我生成日本市场商品页")).toBe("LAUNCH");
    expect(classifyAgentIntent("创建产品护照")).toBe("PASSPORT");
    expect(classifyAgentIntent("创建一个新版本的产品护照")).toBe("PASSPORT");
  });

  it("does not treat a plain overview as confirmation", () => {
    expect(classifyAgentIntent("这个产品怎么样？")).toBe("OVERVIEW");
    expect(classifyAgentIntent("确认产品简报")).toBe("CONFIRM");
  });
});
