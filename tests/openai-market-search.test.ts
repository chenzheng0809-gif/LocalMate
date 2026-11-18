import { afterEach, expect, it, vi } from "vitest";
import { searchMercadoLibre } from "@/lib/localmate/openai-market-search";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("takes only direct product citations from the search response", async () => {
  vi.stubEnv("OPENAI_API_KEY", "fixture-only");
  vi.stubEnv("OPENAI_RESEARCH_MODEL", "fixture-web-model");
  vi.stubEnv("APP_MODE", "LIVE");
  vi.stubEnv("DEMO_MODE", "0");
  const url = "https://articulo.mercadolibre.com.mx/MLM-2925258324-mini-ventilador-_JM";
  const fetchMock = vi.fn(async () => Response.json({ output: [
    { type: "web_search_call" },
    { type: "message", content: [{
      type: "output_text",
      text: "This text is not used as evidence.",
      annotations: [
        { type: "url_citation", title: "Ventilador", url: url + "?utm_source=test" },
        { type: "url_citation", title: "Ventilador", url },
        { type: "url_citation", title: "Fake listing", url: "https://mercadolibre.com.mx.example.com/MLM-2925258324-fake" },
        { type: "url_citation", title: "Search page", url: "https://www.mercadolibre.com.mx/search" },
      ],
    }] },
  ] }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await searchMercadoLibre("便携式风扇")).toEqual({
    status: "searched", citations: [{ url, title: "Ventilador" }],
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("continues without citations when search is disabled or fails", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("OPENAI_RESEARCH_MODEL", "fixture-web-model");
  vi.stubEnv("APP_MODE", "LIVE");
  vi.stubEnv("DEMO_MODE", "0");
  const fetchMock = vi.fn(async () => new Response(null, { status: 429 }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await searchMercadoLibre("便携式风扇")).toEqual({ status: "disabled", citations: [] });
  expect(fetchMock).not.toHaveBeenCalled();
  vi.stubEnv("OPENAI_API_KEY", "fixture-only");
  expect(await searchMercadoLibre("便携式风扇")).toEqual({ status: "unavailable", citations: [] });
});
