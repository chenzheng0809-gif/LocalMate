export type LaunchStatus = "READY_FOR_PILOT" | "NEEDS_REVIEW" | "BLOCKED";

export function launchGate(input: {
  market: string; contribution: number | null; lowContribution: number | null;
  sourceCount: number; complianceStatus: string | null; missing: string[];
}): { status: LaunchStatus; reasons: string[] } {
  const blockers: string[] = [];
  const review: string[] = [];
  if (input.complianceStatus === "RESTRICTED" || input.complianceStatus === "OUT_OF_SCOPE") blockers.push("现有核查记录包含准入阻断。");
  if (input.contribution !== null && input.contribution <= 0) blockers.push("基准情景单件贡献未达到正数。");
  if (input.market !== "MX") review.push("当前试点仅覆盖墨西哥。");
  if (input.contribution === null) review.push("缺少同市场成本测算。");
  if (input.lowContribution !== null && input.lowContribution <= 0) review.push("低价情景单件贡献不为正。");
  if (!input.sourceCount) review.push("缺少可追溯的商品市场证据。");
  if (input.complianceStatus !== "PRECHECK_COMPLETE" || input.missing.length) review.push("仍需核对 SKU 准入与资料。");
  return { status: blockers.length ? "BLOCKED" : review.length ? "NEEDS_REVIEW" : "READY_FOR_PILOT", reasons: [...blockers, ...review] };
}

export type ListingDraft = {
  id: string; handle: string; version: number; title: string; description: string; at: string;
};

export function shopifyDraftCsv(draft: ListingDraft) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const html = draft.description.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replace(/\r?\n/g, "<br>");
  return "URL handle,Title,Description,Status,Published on online store\n" +
    [draft.handle, draft.title, html, "draft", "false"].map(quote).join(",") + "\n";
}

export const listingLocales: Record<string, { locale: string; label: string }> = {
  MX: { locale: "es-MX", label: "墨西哥西班牙语" },
  GB: { locale: "en-GB", label: "英国英语" },
};

const listingCopy = {
  MX: {
    DESK_ORGANIZER: ["Organizador de escritorio", "Organiza artículos de oficina y accesorios pequeños en tu escritorio."],
    STORAGE_BOX: ["Caja organizadora", "Guarda y organiza artículos pequeños en casa."],
    SHELF_RACK: ["Estante organizador", "Ordena artículos de uso diario y mantenlos a la mano."],
    DECOR_STORAGE: ["Organizador para el hogar", "Ordena accesorios y artículos pequeños en casa."],
    OTHER_HOME_ORGANIZATION: ["Organizador para el hogar", "Organiza artículos de uso diario en casa."],
  },
  GB: {
    DESK_ORGANIZER: ["Desk organiser", "Keep stationery and small accessories organised on your desk."],
    STORAGE_BOX: ["Storage box", "Store and organise small items around the home."],
    SHELF_RACK: ["Storage shelf", "Keep everyday items organised and easy to reach."],
    DECOR_STORAGE: ["Home storage organiser", "Organise accessories and small household items."],
    OTHER_HOME_ORGANIZATION: ["Home organiser", "Organise everyday items around the home."],
  },
};

export function localizedListingStarter(product: import("@/types/domain").ProductDNA, market: string) {
  if (!product.confirmed || product.category === "OUT_OF_SCOPE" || product.attributes.electrical === true ||
    (market !== "MX" && market !== "GB")) return null;
  const [title, copy] = listingCopy[market][product.category];
  // Include dimensions only when the record explicitly supplies units and multiple axes.
  const dimensions = product.attributes.dimensions?.trim();
  const measured = dimensions && /^\d+(?:[.,]\d+)?(?:\s*[x×*]\s*\d+(?:[.,]\d+)?){1,2}\s*(?:mm|cm|m|in)$/i.test(dimensions);
  const description = [copy, measured && `${market === "MX" ? "Dimensiones" : "Dimensions"}: ${dimensions}.`].filter(Boolean).join("\n\n");
  return { title, description };
}

export function pilotReviewMarkdown(proposal: import("./board").Proposal, approval: import("./board").Approval, current: boolean) {
  const { snapshot } = proposal;
  const check = snapshot.compliancePrecheck;
  const lines = [
    "# LocalMate pilot review",
    "",
    `Product: ${snapshot.productName}`,
    `Market: ${snapshot.market}`,
    `Proposal: ${proposal.id} · V${proposal.version} · ${proposal.createdAt}`,
    `Snapshot SHA-256: ${proposal.hash}`,
    `Version status: ${current ? "Current" : "Historical — request an updated proposal before acting"}`,
    `Internal preparation approval: ${approval.id} · ${approval.createdAt}`,
    "Review scope: human review of a proposed pilot. Channel publication and formal compliance approval require separate review.",
    "",
    "## Commercial assumptions",
    snapshot.benchmark ? `- Selected comparable: ${snapshot.benchmark.title} · ${snapshot.benchmark.url}` : "- Selected comparable: pending.",
    snapshot.cost ? `- Estimated unit contribution: ${snapshot.cost.currency ?? "CNY"} ${(snapshot.cost.contributionMinor / 100).toFixed(2)} · cost V${snapshot.cost.version} · ${snapshot.cost.source}` : "- Unit contribution: pending.",
    ...(snapshot.benchmarkCostCurrent === false ? ["- Cost assumptions need recalculation for the current comparable."] : []),
    "",
    "## Compliance review",
    `- Pilot assessment: ${snapshot.pilotGate?.status ?? "NEEDS_REVIEW"}`,
    ...(snapshot.pilotGate?.reasons ?? []).map(item => `- ${item}`),
    ...(check ? [
      `- Knowledge base: ${check.query.country} / ${check.query.channel} · as of ${check.as_of} · ${check.status}`,
      ...check.rule_results.map(item => `- ${item.rule_id} — ${item.title}: ${item.classification}`),
      ...[...new Set(check.missing_facts.map(item => item.question))].map(item => `- Question: ${item}`),
      ...[...new Set(check.missing_evidence.map(item => item.description ?? item.evidence_id))].map(item => `- Document requested: ${item}`),
      ...check.citations.map(item => `- Source: ${item.title} · ${item.locator ?? "source page"} · ${item.version ?? "version not recorded"} · ${item.url}`),
    ] : snapshot.guardFindings.map(item => `- ${item}`)),
    "",
    "## Market sources",
    ...snapshot.evidence.map(item => `- ${item.title} · ${item.observedAt} · ${item.verification} · ${item.url}`),
    "",
    "## Internal checklist",
    ...approval.tasks.map(task => `- [${task.status === "done" ? "x" : " "}] ${task.owner} · ${task.title}`),
  ];
  if (approval.draft) lines.push("", `## Listing draft (${listingLocales[snapshot.market]?.locale ?? snapshot.market}, V${approval.draft.version})`,
    approval.draft.title, "", approval.draft.description);
  return lines.join("\n") + "\n";
}
