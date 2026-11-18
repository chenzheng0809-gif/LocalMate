import { config } from "@/lib/config";
import { localCorpusSearch } from "@/lib/search/local-corpus";
import { createRemoteSearchClient } from "@/lib/search/remote";
import type { SearchClient } from "@/lib/search/types";

let singleton: SearchClient | null = null;

const noneSearch: SearchClient = {
  mode: "NONE",
  provider: "none",
  async search(query) {
    return {
      query,
      provider: "none",
      mode: "NONE",
      results: [],
      notes: ["没有配置搜索服务。"],
      searchedAt: new Date().toISOString(),
      cached: false,
    };
  },
  async searchMany(queries) {
    return Promise.all(queries.map((query) => this.search(query)));
  },
};

export function getSearchClient(): SearchClient {
  if (singleton) return singleton;
  const remote = createRemoteSearchClient();
  if (remote) {
    singleton = remote;
  } else if (config.search.provider === "none") {
    singleton = noneSearch;
  } else {
    singleton = localCorpusSearch;
  }
  return singleton;
}

export function resetSearchClient(): void {
  singleton = null;
}

export function searchModeLabel(): "LIVE_SEARCH" | "LOCAL_CORPUS" | "NONE" {
  const client = getSearchClient();
  return client.mode === "LIVE_SEARCH" ? "LIVE_SEARCH" : client.mode === "LOCAL_CORPUS" ? "LOCAL_CORPUS" : "NONE";
}
