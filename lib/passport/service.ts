import { nowIso } from "@/lib/db/client";
import type { Repositories } from "@/lib/repositories";
import { COUNTRY_META } from "@/types/domain";
import type { PassportSnapshot } from "@/types/domain";
import { AppError } from "@/lib/errors";

export function buildNextActions(input: {
  productName: string;
  markets: PassportSnapshot["markets"];
  compliance: PassportSnapshot["compliance"];
  match: PassportSnapshot["match"];
  hasLaunch: boolean;
}): string[] {
  const actions: string[] = [];
  const { compliance, markets, match } = input;
  const reviewCountries = compliance.filter((check) => check.status === "REVIEW_REQUIRED").map((check) => check.country);
  const actionCountries = compliance.filter((check) => check.status === "ACTION_REQUIRED").map((check) => check.country);
  const blockedCountries = compliance
    .filter((check) => check.status === "RESTRICTED" || check.status === "OUT_OF_SCOPE")
    .map((check) => check.country);
  if (reviewCountries.length > 0) {
    actions.push(`${reviewCountries.map((country) => COUNTRY_META[country].name).join("、")}：在投入发布预算前，关闭开放的合规证据缺口。`);
  }
  if (actionCountries.length > 0) {
    actions.push(`${actionCountries.map((country) => COUNTRY_META[country].name).join("、")}：完成合规预检中的卖家动作。`);
  }
  if (blockedCountries.length > 0) {
    actions.push(`${blockedCountries.map((country) => COUNTRY_META[country].name).join("、")}：不要发布——合规门已被阻断。`);
  }
  if (match?.recommendedCountry) {
    actions.push(
      `在${COUNTRY_META[match.recommendedCountry].name}用有边界的测试验证需求；不要把分数当成发布批准。`,
    );
  }
  for (const market of markets) {
    if (market.missingData.includes("Product weight (needed for a credible shipping scenario)")) {
      actions.push(`补充${COUNTRY_META[market.country].name}市场所需的带包装重量和纸箱尺寸。`);
      break;
    }
  }
  if (!input.hasLaunch) actions.push("为优先市场生成本地化发布页。");
  if (actions.length === 0) actions.push("在投入发布预算前，收集第二轮证据。");
  return Array.from(new Set(actions)).slice(0, 8);
}

export function createPassport(input: {
  repos: Repositories;
  productId: string;
  note?: string;
}): PassportSnapshot {
  const { repos, productId } = input;
  const product = repos.products.getById(productId);
  if (!product) throw new AppError("产品不存在。", { status: 404 });
  const markets = repos.research.getByProduct(productId);
  if (markets.length === 0) {
    throw new AppError("请先运行研究，再创建护照。", { status: 409 });
  }
  const job = repos.jobs.getLatestByProduct(productId);
  const compliance = repos.compliance.getByProduct(productId);
  const match = repos.matches.getLatest(productId);
  const launchPage = repos.launch.getLatestByProduct(productId);
  const evidence = repos.evidence.listByProduct(productId, 200);
  const dataMode = product.mode === "DEMO"
    ? "DEMO"
    : markets.some((market) => market.dataMode === "LIVE")
      ? "LIVE"
      : "LOCAL_EVIDENCE";
  const snapshot: PassportSnapshot = {
    passportId: "",
    version: 0,
    product,
    job,
    markets,
    compliance,
    match,
    launchPage,
    evidence,
    nextActions: buildNextActions({
      productName: product.name,
      markets,
      compliance,
      match,
      hasLaunch: Boolean(launchPage),
    }),
    generatedAt: nowIso(),
    dataMode,
    disclaimer:
      "产品护照是决策支持文件。市场观察有日期且范围有限；HS 编码是候选，不是有约束力的归类；合规预检不是法律意见或官方认证。在投入预算或发布前请核实。",
  };
  const record = repos.passports.create(productId, snapshot);
  return record.snapshot;
}

export function getPassport(repos: Repositories, productId: string): PassportSnapshot {
  const record = repos.passports.getLatest(productId);
  if (!record) throw new AppError("该产品还没有护照。请在研究后创建。", { status: 404 });
  return record.snapshot;
}

export function exportPassport(repos: Repositories, productId: string, version?: number): {
  filename: string;
  json: string;
  snapshot: PassportSnapshot;
} {
  const record = version !== undefined ? repos.passports.getByVersion(productId, version) : repos.passports.getLatest(productId);
  if (!record) throw new AppError(version !== undefined ? `护照版本 v${version} 不存在。` : "该产品还没有护照。请在研究后创建。", { status: 404 });
  const snapshot = record.snapshot;
  return {
    filename: `product-passport-${productId}-v${snapshot.version}.json`,
    json: JSON.stringify(snapshot, null, 2),
    snapshot,
  };
}
