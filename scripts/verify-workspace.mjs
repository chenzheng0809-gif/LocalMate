/** Acceptance test for the built app. Uses a temporary SQLite DB and real HTTP, with no provider keys. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const temp = await mkdtemp(join(tmpdir(), "localmate-verify-"));
const reserve = createServer();
reserve.listen(0, "127.0.0.1");
await once(reserve, "listening");
const port = reserve.address().port;
await new Promise((resolve, reject) => reserve.close(error => error ? reject(error) : resolve()));
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, NODE_ENV: "production", DATABASE_PATH: join(temp, "workspace.db"),
  UPLOAD_DIR: join(temp, "uploads"), SEARCH_PROVIDER: "local", DISABLE_RETAIL_PROBE: "1",
  LOCALMATE_SMTP_HOST: "", LOCALMATE_SMTP_FROM: "", OCTOPUS_API_KEY: "", DEEPSEEK_API_KEY: "", AI_API_KEY: "", FETCH_TIMEOUT_MS: "5000" };
const children = [];
function start(args) {
  const child = spawn(process.execPath, args, { stdio: "inherit", env });
  children.push(child);
  return child;
}
async function stop(child, signal = "SIGTERM") {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  const killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
  child.kill(signal);
  try { await exited; } finally { clearTimeout(killTimer); }
}
function web() {
  return start([require.resolve("next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)]);
}
function worker() {
  return start(["--import", "tsx", "scripts/workflow-worker.ts"]);
}
async function api(path, body, { method = body === undefined ? "GET" : "POST", status = 200 } = {}) {
  const response = await fetch(base + path, { method, signal: AbortSignal.timeout(8000),
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${text.slice(0, 800)}`);
  return JSON.parse(text);
}
async function until(probe, description, { ms = 90_000, interval = 100 } = {}) {
  const expires = Date.now() + ms;
  while (Date.now() < expires) {
    const result = await probe();
    if (result) return result;
    await delay(interval);
  }
  throw new Error(`Timed out: ${description}`);
}
const statusPath = "/api/system/status";
async function ready() {
  await until(async () => {
    try { await api(statusPath); return true; } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
  }, "web readiness", { ms: 10_000 });
}

try {
  let server = web();
  await ready();
  assert.equal((await api(statusPath)).worker.online, false);
  const { product } = await api("/api/products", { name: "Plastic desk organizer", category: "DESK_ORGANIZER",
    material: "plastic", weight: 0.4, dimensions: "20 x 15 x 10 cm", intendedUse: "Office storage",
    electrical: false, priceCNY: 25 }, { status: 201 });
  const productApi = `/api/products/${product.id}`;
  await api("/api/research/start", { productId: product.id, countries: ["UK"] }, { status: 409 });
  await api(`${productApi}/confirm`, { confirm: true });

  const { mission } = await api("/api/localmate/projects", { requestId: randomUUID(), productId: product.id,
    direction: "product_to_market", goal: "工作台生产验收：桌面收纳试卖", markets: ["MX", "BR"], deferResearch: true }, { status: 201 });
  const missionApi = `/api/localmate/missions/${mission.id}`;
  const evidenceApi = `${missionApi}/evidence`;
  const board = `${missionApi}/board`;
  const original = (await api(board, { type: "generate", market: "MX" })).proposal;
  const lead = {
    market: "MX", title: "IKEA México · NOJIG Organizador", url: "https://www.ikea.com/mx/es/search/?q=NOJIG",
    observedAt: "2026-11-15", excerpt: "验收使用公开目录入口，保持待核验；未录入任何售价或销量。",
  };
  const { observation } = await api(evidenceApi, lead, { status: 201 });
  const repeated = await api(evidenceApi, lead, { status: 201 });
  assert.equal(repeated.observation.id, observation.id);
  await api(evidenceApi, { ...lead, market: "GB" }, { status: 422 });
  await api(evidenceApi, { ...lead, url: "javascript:alert(1)" }, { status: 422 });
  await api(board, { type: "approve", proposalId: original.id, hash: original.hash }, { status: 409 });
  const taskApi = `${missionApi}/tasks`;
  const cmd = { type: "dispatch", requestId: randomUUID(), instruction: "@Scout 对比墨西哥和巴西的竞品" };
  const queued = await api(taskApi, cmd, { status: 202 });
  assert.equal(queued.tasks[0].status, "queued");
  await api(taskApi, cmd, { status: 202 });
  const benchmarkApi = `${missionApi}/benchmark`;
  await api(benchmarkApi, { market: "BR", comparableId: observation.id }, { status: 409 });
  const { benchmark } = await api(benchmarkApi, { market: "MX", comparableId: observation.id, notes: "比较同尺寸组合装" });
  assert.equal(benchmark.url, observation.url);
  assert.equal(benchmark.notes, "比较同尺寸组合装");
  const { mission: withBenchmark } = await api(missionApi);
  const repeatedBenchmark = await api(benchmarkApi, { market: "MX", comparableId: observation.id, notes: benchmark.notes });
  assert.equal(repeatedBenchmark.benchmark.selectedAt, benchmark.selectedAt);
  assert.equal((await api(missionApi)).mission.revision, withBenchmark.revision);
  await api(missionApi, { type: "save_cost", revision: withBenchmark.revision, market: "MX", price: "110",
    procurement: "30", logistics: "15", channelFees: "8", taxes: "5", acquisition: "10", source: "验收输入" }, { method: "PATCH" });
  await api(taskApi, { type: "dispatch", requestId: randomUUID(), instruction: "@Margin 测算墨西哥利润" }, { status: 202 });
  let runner = worker();
  const tasks = await until(async () => {
    assert.equal(runner.exitCode, null, "Worker exited before processing tasks");
    const feed = await api(taskApi);
    return feed.tasks.length === 2 && feed.tasks.every(task => !["queued", "running"].includes(task.status)) && feed.tasks;
  }, "Scout and Margin complete their pass");
  const scout = tasks.find(task => task.agent === "Scout");
  assert.equal(scout.status, "waiting");
  assert.equal(scout.result.evidence[0].origin, "USER_INPUT");
  assert.match(scout.result.details.join(" "), /巴西/);
  const margin = tasks.find(task => task.agent === "Margin");
  assert.equal(margin.status, "completed");
  assert.match(margin.result.details[0], /42\.00/);
  const { proposal } = await api(board, { type: "generate", market: "MX" });
  assert.equal(proposal.snapshot.evidence[0].verification, "UNVERIFIED");
  assert.equal(proposal.snapshot.benchmark.id, observation.id);
  assert.equal(proposal.snapshot.benchmarkCostCurrent, true);
  const approval = (await api(board, { type: "approve", proposalId: proposal.id, hash: proposal.hash })).approval;
  assert.equal(approval.tasks.length, 4);
  const { draft: starter } = await api(board, { type: "draft_start", approvalId: approval.id });
  assert.equal(starter.title, "Organizador de escritorio");
  assert.match(starter.description, /Dimensiones: 20 x 15 x 10 cm/);
  const { draft } = await api(board, { type: "draft", approvalId: approval.id,
    title: "Organizador de escritorio", description: "Organizador para artículos de oficina." });
  assert.equal(draft.version, starter.version + 1);
  assert.equal((await api(board, { type: "draft_start", approvalId: approval.id })).draft.id, draft.id);
  await api(board, { type: "complete", taskId: approval.tasks[0].id });
  const html = await fetch(`${base}/workspace/${mission.id}`).then(response => response.text());
  assert.ok(html.includes("添加市场来源") && html.includes(lead.title));
  const pageMarkup = async response => (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const boardPage = `/workspace/${mission.id}?view=board`;
  const approvalLanding = await fetch(base + boardPage);
  assert.equal(approvalLanding.status, 200);
  const decisionHtml = await pageMarkup(approvalLanding);
  assert.match(decisionHtml, /aria-current="step" href="[^"]*step=decide(?:&amp;market=[A-Z]{2})?"/);
  assert.match(decisionHtml, /方案与执行清单/);
  assert.match(decisionHtml, /已授权准备 · 1\/4 项完成/);
  assert.match(decisionHtml, /买家视角预览/);
  assert.match(decisionHtml, /Organizador para artículos de oficina/);
  assert.match(decisionHtml, /下载试点评审包/);
  assert.doesNotMatch(decisionHtml, /id="project-cost"/);
  const researchHtml = await fetch(`${base}${boardPage}&step=research`).then(pageMarkup);
  assert.match(researchHtml, /1\/2 个市场已有来源/);
  assert.match(researchHtml, /已选对标/);
  assert.match(researchHtml, /查找墨西哥竞品/);
  assert.match(researchHtml, /暂无来源显示销量超过 500 件/);
  const emptyMarket = await fetch(`${base}${boardPage}&step=research&market=BR`).then(pageMarkup);
  assert.match(emptyMarket, /巴西暂无可对标商品/);
  assert.doesNotMatch(researchHtml, /id="proposal-versions"/);
  const evaluateHtml = await fetch(`${base}${boardPage}&step=evaluate`).then(pageMarkup);
  assert.match(evaluateHtml, /id="project-cost"/);
  assert.match(evaluateHtml, /核查墨西哥准入/);
  assert.match(evaluateHtml, /比较同尺寸组合装/);
  assert.match(evaluateHtml, /顾问任务与自定义指令/);
  assert.doesNotMatch(evaluateHtml, /id="proposal-versions"/);
  console.log("PASS  board routes show only their stage tools and open an approved project at decisions");

  console.log("PASS  confirmed manual input → worker → sourced comparison, exact margin, versioned approval and draft");

  await api("/api/localmate/projects", { requestId: randomUUID(), direction: "market_to_product",
    goal: "查找办公收纳候选", markets: ["MX"], deferResearch: true }, { status: 422 });
  await api("/api/localmate/missions", { requestId: randomUUID(), direction: "market_to_product",
    goal: "查找办公收纳候选", markets: ["MX"] }, { status: 422 });
  const entry = await fetch(base).then(pageMarkup);
  assert.match(entry, /告诉 LocalMate，你想做什么/);
  assert.match(entry, /一个人，也能拥有<span>全球商业团队<\/span>/);
  assert.match(entry, /aria-label="出海需求"/);
  assert.doesNotMatch(entry, /我有目标市场，想找机会/);

  if (process.env.VERIFY_COMPLIANCE_KB === "1") {
    const { mission: gb } = await api("/api/localmate/projects", { requestId: randomUUID(),
      direction: "product_to_market", productId: product.id, goal: "英国合规知识库验收", markets: ["GB"], deferResearch: true }, { status: 201 });
    const gbTasks = `/api/localmate/missions/${gb.id}/tasks`;
    const gbBoard = `/api/localmate/missions/${gb.id}/board`;
    const { proposal: before } = await api(gbBoard, { type: "generate", market: "GB" });
    await api(gbTasks, { type: "dispatch", requestId: randomUUID(), instruction: "@Guard 核查英国 Amazon UK 桌面收纳合规" }, { status: 202 });
    const task = await until(async () => {
      const { tasks: [item] } = await api(gbTasks);
      return item && !["queued", "running"].includes(item.status) && item;
    }, "real Python compliance bridge");
    assert.equal(task.status, "waiting", task.result?.summary);
    const check = task.result.compliancePrecheck;
    assert.equal(check.productId, product.id);
    assert.equal(check.query.country, "GB");
    assert.equal(check.query.channel, "amazon_uk");
    assert.equal(check.status, "insufficient_data");
    assert.equal(check.policy.compliance_pass, false);
    assert.ok(check.rule_results.length > 0);
    assert.ok(!check.missing_facts.some(item => item.fact === "is_electric"));
    assert.ok(check.missing_facts.some(item => item.fact === "intended_for_children"));
    assert.ok(check.missing_evidence.some(item => item.evidence_id === "technical_file"));
    assert.ok(check.citations.some(item => item.locator_type === "retrieved_passage" && item.url.startsWith("https://")));
    const { proposal: after } = await api(gbBoard, { type: "generate", market: "GB" });
    assert.notEqual(after.hash, before.hash);
    assert.equal(after.snapshot.compliancePrecheck.engineVersion, check.engineVersion);
    assert.equal(after.snapshot.pilotGate.status, "NEEDS_REVIEW");
    await api(`${missionApi}/board?review=${after.id}`, undefined, { status: 404 });
    const gbApproval = (await api(gbBoard, { type: "approve", proposalId: after.id, hash: after.hash })).approval;
    const gbDraft = (await api(gbBoard, { type: "draft_start", approvalId: gbApproval.id })).draft;
    assert.equal(gbDraft.title, "Desk organiser");
    const reviewResponse = await fetch(`${base}${gbBoard}?review=${gbApproval.id}`);
    assert.equal(reviewResponse.status, 200);
    assert.match(reviewResponse.headers.get("content-disposition"), /attachment/);
    const review = await reviewResponse.text();
    assert.match(review, /Version status: Current/);
    assert.match(review, /GB-DESK-GPSR-001/);
    assert.match(review, /Document requested:/);
    assert.match(review, /https:\/\/(www\.)?(gov\.uk|hse\.gov\.uk|trade-tariff\.service\.gov\.uk)/);
    assert.match(review, /Listing draft \(en-GB/);
    await api(`${board}?review=${gbApproval.id}`, undefined, { status: 404 });
    const page = await fetch(`${base}/workspace/${gb.id}?view=board&step=evaluate`);
    const markup = await page.text();
    assert.equal(page.status, 200);
    assert.match(markup, /gb-compliance-precheck/);
    assert.match(markup, /待提供的文件/);
    assert.match(markup, /引用与原文/);
    assert.match(markup, /运行英国 Amazon UK 合规预检/);
    await api(productApi, { material: "recycled plastic" }, { method: "PATCH" });
    await api(`${productApi}/confirm`, { confirm: true });
    assert.equal((await api(gbBoard, { type: "generate", market: "GB" })).proposal.snapshot.compliancePrecheck, undefined);
    const oldReview = await fetch(`${base}${gbBoard}?review=${gbApproval.id}`).then(response => response.text());
    assert.match(oldReview, /Version status: Historical/);
    console.log(`PASS  real Python bridge → Guard → UK citations and evidence gaps, ${check.rule_results.length} candidate rules, stale product assessment excluded`);
  }

  const offerPrompt = "我有一款旅行收纳袋，相比较美国、加拿大和泰国市场的机会。";
  const { mission: guided } = await api("/api/localmate/projects", { requestId: randomUUID(),
    direction: "product_to_market", goal: offerPrompt, deferResearch: true }, { status: 201 });
  assert.deepEqual(guided.markets, ["US", "CA", "TH"]);
  const guidedApi = `/api/localmate/missions/${guided.id}`;
  const guidedPage = `/workspace/${guided.id}`;
  const stepOne = await fetch(base + guidedPage).then(pageMarkup);
  assert.match(stepOne, /第一步 · 确认商品参数/);
  assert.match(stepOne, /使用 1688、淘宝或天猫链接自动录入/);
  assert.match(stepOne, /单品包装尺寸/);
  assert.match(stepOne, /name="dimensions2"/);
  assert.match(stepOne, /<option>mm<\/option>/);
  assert.doesNotMatch(stepOne, /第二步 · 确认研究市场/);
  assert.equal((await api(`/api/products/${guided.productId}`)).product.name, "旅行收纳袋");
  const guidedProduct = `/api/products/${guided.productId}`;
  await api(guidedProduct, { dimensions: "30 × 20 × 5 cm", packagingDimensions: "32 × 22 × 6 cm",
    weight: 0.45, priceCNY: 28 }, { method: "PATCH" });
  await api(`${guidedProduct}/confirm`, { confirm: true });
  const stepTwo = await fetch(base + guidedPage).then(pageMarkup);
  assert.match(stepTwo, /第二步 · 确认研究市场/);
  assert.match(stepTwo, /scout-approved/);
  assert.match(stepTwo, /试卖总预算/);
  assert.doesNotMatch(stepTwo, /加拿大<\/label>|泰国<\/label>/);
  const reportCommand = { type: "save_plan", requestId: randomUUID(), revision: guided.revision,
    markets: ["MX", "DE", "GB", "BR", "US", "JP"], sourcing: "", procurementLimit: null, budget: 1800 };
  await api(`${guidedApi}/prepare`, { ...reportCommand, requestId: randomUUID(), markets: ["CA"] }, { status: 422 });
  const { reportId } = await api(`${guidedApi}/prepare`, reportCommand, { status: 202 });
  assert.equal(reportId, reportCommand.requestId);
  await api(`${guidedApi}/prepare`, reportCommand, { status: 202 });
  const guidedTasks = await until(async () => {
    const { tasks } = await api(`${guidedApi}/tasks`);
    assert.equal(tasks.length, 4);
    return tasks.every(task => !["running", "queued"].includes(task.status)) && tasks;
  }, "four-advisor report");
  for (const task of guidedTasks) {
    assert.equal(task.status, "completed", task.result?.summary);
    assert.equal(task.result.sections.length, 6);
  }
  const reportPath = `${guidedApi}/report?run=${reportId}`;
  const reportFile = await fetch(base + reportPath);
  assert.equal(reportFile.status, 200);
  const reportText = await reportFile.text();
  assert.equal((reportText.match(/^## /gm) ?? []).length, 6);
  assert.match(reportText, /收纳袋 · 出海研究报告/);
  assert.doesNotMatch(reportText, /压力保本|试算价|报价与准入复核|对标依据/);
  assert.match(reportText, /ZSVR/);
  assert.match(reportText, /NOM/);
  assert.match(reportText, /sellercentral\.amazon\.com\.br/);
  assert.match(reportText, /Organizador de equipaje/);
  assert.match(reportText, /旅行用衣類収納ポーチ/);
  const renderedReport = await fetch(`${base}${guidedPage}?view=report&run=${reportId}`).then(pageMarkup);
  assert.match(renderedReport, /市场交付文件/);
  assert.doesNotMatch(renderedReport, /压力保本|对标依据|报价与准入复核/);
  const reportProgress = renderedReport.match(/<ul[^>]+aria-label="四位顾问的进度"[^>]*>(.*?)<\/ul>/s)?.[1] ?? "";
  assert.equal((reportProgress.match(/data-status="completed"/g) ?? []).length, 4);

  const handoffPath = `${guidedApi}/handoff?run=${reportId}&market=US`;
  let handoff = (await api(handoffPath)).state;
  async function save(input) {
    handoff = (await api(handoffPath, { ...input, version: handoff.version })).state;
  }
  async function upload(kind, name, bytes) {
    const form = new FormData();
    form.set("kind", kind);
    form.set("version", String(handoff.version));
    form.set("file", new Blob([bytes]), name);
    if (handoff.rfq) form.set("rfqId", handoff.rfq.id);
    const res = await fetch(base + handoffPath, { method: "POST", body: form });
    const data = await res.json();
    assert.equal(res.status, 200, JSON.stringify(data));
    handoff = data.state;
    return data.file.id;
  }
  async function asset(name, extra = "") {
    const res = await fetch(`${base}${handoffPath}&export=${name}${extra}`);
    assert.equal(res.status, 200, name);
    return Buffer.from(await res.arrayBuffer());
  }
  async function sheet(bytes) {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    return book.getWorksheet(1);
  }
  await Promise.all(reportCommand.markets.map(async market => {
    const url = `${base}${guidedApi}/handoff?run=${reportId}&market=${market}&export=channel`;
    const res = await fetch(url);
    assert.equal(res.status, 200);
    const worksheet = await sheet(Buffer.from(await res.arrayBuffer()));
    assert.equal(worksheet.getCell("A2").value, market);
    assert.match(worksheet.getCell("E2").value.hyperlink, /^https:\/\/sellercentral\.amazon\./);
  }));
  await save({ type: "prepare" });
  assert.match(handoff.agent.listing.description, /Packaged dimensions: 32 × 22 × 6 cm/);
  assert.doesNotMatch(handoff.agent.listing.description, /\bUSD\b/);
  assert.equal(handoff.listing, undefined);
  assert.match((await asset("copy-draft")).toString(), /Travel packing organizer/);
  await save({ type: "channel", category: "Fixture / Packing organizers", status: "沟通中" });
  const channel = await sheet(await asset("channel"));
  assert.equal(channel.getCell("K2").value, "沟通中");
  await save({ type: "listing", listing: { title: "Fixture Travel Organizer", description: "Fixture listing, for automated verification only.", sku: "FIXTURE-001" } });
  assert.match((await asset("copy")).toString(), /FIXTURE-001/);
  const model = new ExcelJS.Workbook();
  const target = model.addWorksheet("Template");
  target.addRows([["SKU", "Title", "Width cm", "Original formula"], ["", "", "", { formula: "1+1", result: 2 }]]);
  target.getCell("B2").dataValidation = { type: "list", allowBlank: true, formulae: ['"Example,Fixture Travel Organizer"'] };
  model.addWorksheet("Reference").getCell("A1").value = "Fixture reference";
  const fixture = Buffer.from(await model.xlsx.writeBuffer());
  const templateId = await upload("template", "fixture-template.xlsx", fixture);
  await save({ type: "prepare", file: templateId });
  const templateDraft = handoff.agent.documents[templateId];
  assert.deepEqual(templateDraft.mappings.map(item => [item.cell, item.field]), [["A2", "sku"], ["B2", "title"], ["C2", "widthCm"]]);
  assert.match(templateDraft.evidence.B2, /B1 · Title/);
  assert.equal(handoff.template, undefined);
  await save({ type: "template", file: templateId, mappings: [
    { sheet: "Template", cell: "A2", field: "sku" }, { sheet: "Template", cell: "B2", field: "title" }, { sheet: "Template", cell: "C2", field: "widthCm" },
    { sheet: "Template", cell: "E3", field: "custom", custom: "centimeters" },
  ] });
  const populated = await asset("template");
  const listingSheet = await sheet(populated);
  assert.equal(listingSheet.getCell("A2").value, "FIXTURE-001");
  assert.equal(listingSheet.getCell("C2").value, 20);
  assert.equal(listingSheet.getCell("E3").value, "centimeters");
  assert.equal(listingSheet.getCell("D2").formula, "1+1");
  assert.equal(listingSheet.getCell("B2").dataValidation.type, "list");
  assert.deepEqual(await (await JSZip.loadAsync(populated)).file("xl/worksheets/sheet2.xml").async("nodebuffer"),
    await (await JSZip.loadAsync(fixture)).file("xl/worksheets/sheet2.xml").async("nodebuffer"));

  const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const request = { origin: "Fixture origin 518000", destination: "Fixture destination 90001", mode: "Air", terms: "DAP",
    contact: "dispatch@example.invalid", ready: future, units: 10, carton: null };
  await save({ type: "prepare", shipment: `起运地：${request.origin}\n目的地：${request.destination}\n件数：10\n运输方式：空运\n备货日期：${future}\n贸易条款：DAP\n出货包装：单品包装\n货代邮箱：${request.contact}` });
  assert.equal(handoff.rfq, undefined);
  assert.deepEqual(handoff.agent.shipment, request);
  await save({ type: "rfq", rfq: handoff.agent.shipment });
  const unitSheet = await sheet(await asset("rfq"));
  assert.equal(unitSheet.getCell("M2").value, 32);
  assert.equal(unitSheet.getCell("Q2").value, .45);
  await save({ type: "rfq", rfq: { ...request, carton: { dimensions: "0.55 × 0.40 × 0.35 m", count: 2, grossKg: 3.2 } } });
  const rfqId = handoff.rfq.id;
  const cartonSheet = await sheet(await asset("rfq"));
  assert.equal(cartonSheet.getCell("L2").value, 2);
  assert.equal(cartonSheet.getCell("M2").value, .55);
  assert.equal(cartonSheet.getCell("P2").value, "m");
  assert.equal(cartonSheet.getCell("Q2").value, 3.2);
  await api(handoffPath, { type: "send", rfqId, version: handoff.version }, { status: 409 });
  await save({ type: "sent", rfqId });
  assert.equal(handoff.rfq.mail.status, "recorded");
  const priceId = await upload("price", "fixture-price.csv", `SKU,Currency,Unit price,Valid through,Seller,Buyer\nFIXTURE-002,USD,90.00,${future},Fixture Seller,Fixture Buyer\nFIXTURE-001,USD,12.45,${future},Fixture Seller,Fixture Buyer`);
  await save({ type: "prepare", file: priceId });
  const priceDraft = handoff.agent.documents[priceId];
  assert.equal(priceDraft.values.amount, "12.45", JSON.stringify(priceDraft));
  assert.equal(priceDraft.values.currency, "USD");
  assert.equal(priceDraft.values.seller, "Fixture Seller");
  assert.match(priceDraft.values.reference, /CSV C3/);
  assert.equal(handoff.price, undefined);
  await save({ type: "price", file: priceId, ...priceDraft.values });
  const replyDoc = new PDFDocument();
  const replyChunks = [];
  replyDoc.on("data", chunk => replyChunks.push(chunk));
  const finished = once(replyDoc, "end");
  replyDoc.text(`TEST FIXTURE ONLY. Freight quote EX-44, total USD 45.50. Transit 5 days. Valid through ${future}.`);
  replyDoc.text("Forwarder: Fixture Forwarder");
  replyDoc.text("Included: Air freight");
  replyDoc.text("Excluded: Import taxes");
  replyDoc.end();
  await finished;
  const rawReply = Buffer.concat(replyChunks);
  const replyId = await upload("reply", "fixture-forwarder.pdf", rawReply);
  assert.match((await api(`${handoffPath}&export=excerpt&file=${replyId}`)).excerpt, /USD 45\.50/);
  assert.deepEqual(await asset("original", `&file=${replyId}`), rawReply);
  await save({ type: "prepare", file: replyId });
  const replyDraft = handoff.agent.documents[replyId];
  assert.deepEqual({ ...replyDraft.values, proof: undefined }, { forwarder: "Fixture Forwarder", originalRef: "EX-44", currency: "USD", amount: "45.50",
    scope: "Air freight", excludes: "Import taxes", transit: "5 days", expires: future, proof: undefined });
  assert.match(replyDraft.values.proof, /第 1 页 · .+USD 45\.50/);
  assert.equal(handoff.replies.length, 0);
  await save({ type: "reply", file: replyId, rfqId, reply: replyDraft.values });
  const ambiguousId = await upload("reply", "fixture-two-freight-totals.txt", "Total freight: USD 45.50\nTotal freight: USD 55.50");
  await save({ type: "prepare", file: ambiguousId });
  assert.equal(handoff.agent.documents[ambiguousId].values.amount, undefined);
  await save({ type: "select", file: replyId, rfqId });
  const originals = await JSZip.loadAsync(await asset("originals"));
  assert.deepEqual(await originals.file(`原始回单/${replyId}/fixture-forwarder.pdf`).async("nodebuffer"), rawReply);
  assert.equal((await sheet(await originals.file("报价对照.xlsx").async("nodebuffer"))).getCell("J2").value, "已采用");
  await save({ type: "quote", rfqId, buyer: "Fixture Buyer", seller: "Fixture Seller", product: "Fixture Travel Organizer", notes: "TEST FIXTURE ONLY" });
  const pdf = await asset("quote");
  if (process.env.LOCALMATE_QUOTE_FIXTURE_OUTPUT) await writeFile(process.env.LOCALMATE_QUOTE_FIXTURE_OUTPUT, pdf);
  const document = new PDFParse({ data: new Uint8Array(pdf) });
  try {
    const { text } = await document.getText();
    assert.match(text, /TOTAL\s+USD 170\.00/);
    assert.match(text, /TEST FIXTURE ONLY/);
    assert.match(text, new RegExp(handoff.quote.id));
  } finally { await document.destroy(); }
  const trace = await sheet(await asset("trace"));
  assert.equal(trace.getCell("H2").value, "fixture-price.csv");
  assert.equal(trace.getCell("H3").value, "fixture-forwarder.pdf");
  await save({ type: "price", file: priceId, currency: "USD", amount: "13.45", expires: future, reference: "Line 1 · updated fixture" });
  await api(`${handoffPath}&export=quote`, undefined, { status: 409 });
  const material = await upload("material", "fixture-label.txt", "TEST FIXTURE - not a compliance approval");
  await save({ type: "requirement", name: "Fixture material received", rule: "https://www.ftc.gov/", submit: "https://sellercentral.amazon.com/", locator: "Fixture only, not a rule", file: material });
  await save({ type: "requirement", name: "Fixture missing material", rule: "https://www.ftc.gov/", submit: "https://sellercentral.amazon.com/", locator: "Fixture only, not a rule", file: null });
  const materials = await JSZip.loadAsync(await asset("materials"));
  assert.match(await materials.file(`材料原件/${material}/fixture-label.txt`).async("string"), /TEST FIXTURE/);
  assert.equal((await sheet(await materials.file("材料和补件.xlsx").async("nodebuffer"))).getCell("B3").value, "缺件");
  const { mission: fan } = await api("/api/localmate/projects", {
    requestId: randomUUID(), direction: "product_to_market", deferResearch: true,
    goal: "我有一款便携式充电风扇，想进入墨西哥 Mercado Libre，帮我评估市场、成本和准入。",
  }, { status: 201 });
  assert.deepEqual(fan.markets, ["MX"]);
  const fanProduct = `/api/products/${fan.productId}`;
  await api(fanProduct, { name: "便携式充电风扇", dimensions: "15 × 8 × 4 cm",
    packagingDimensions: "17 × 10 × 6 cm", weight: 0.32, priceCNY: 25 }, { method: "PATCH" });
  await api(`${fanProduct}/confirm`, { confirm: true });
  const fanApi = `/api/localmate/missions/${fan.id}`;
  const planMexico = { type: "save_plan", requestId: randomUUID(), revision: fan.revision, markets: ["MX"],
    sourcing: "", procurementLimit: null, budget: 1800 };
  const { reportId: fanRun } = await api(`${fanApi}/prepare`, planMexico, { status: 202 });
  await api(`${fanApi}/prepare`, { ...planMexico, mexicoMarketplace: "amazon" }, { status: 409 });
  const fanTasks = await until(async () => {
    const { tasks } = await api(`${fanApi}/tasks`);
    return tasks.length === 4 && tasks.every(task => !["queued", "running"].includes(task.status)) && tasks;
  }, "Mercado Libre fan report");
  assert.ok(fanTasks.every(task => task.status === "completed"), JSON.stringify(fanTasks));
  assert.ok(fanTasks.every(task => task.report.mexicoMarketplace === "mercado_libre"));
  const fanScout = fanTasks.find(task => task.agent === "Scout").result;
  assert.equal(fanScout.evidence.filter(item => item.note?.includes("页面销量")).length, 4);
  const fanGuard = fanTasks.find(task => task.agent === "Guard").result.sections[0];
  assert.equal(fanGuard.releaseHold, true);
  assert.ok(fanGuard.lines.some(line => line.includes("资料不足") && line.includes("电池类型")));
  const fanPage = `/workspace/${fan.id}`;
  const fanReportMarkup = await fetch(`${base}${fanPage}?view=report&run=${fanRun}`).then(pageMarkup);
  assert.match(fanReportMarkup, /第 2 步 · 核对研究与竞品/);
  assert.match(fanReportMarkup, /打开利润测算/);
  assert.match(fanReportMarkup, /第 4 步 · 生成市场交付文件/);
  await api(`${fanApi}/benchmark`, { market: "MX", comparableId: "mx-cm-top", notes: "导入挂牌价，仅作对比" });
  const fanRevision = (await api(fanApi)).mission.revision;
  const fanCost = { type: "save_cost", revision: fanRevision, market: "MX", price: "249", procurement: "62.50",
    logistics: "40", channelFees: "40", taxes: "15", acquisition: "20", source: "验收场景假设",
    valuation: { currency: "MXN", fxToCny: "0.40", fxAt: "2026-01-15T00:00:00Z", fxSource: "验收假设",
      lowPrice: "199", highPrice: "279", fixedCost: "500" } };
  await api(fanApi, fanCost, { method: "PATCH" });
  const { costs: [fanSavedCost] } = await api(fanApi);
  assert.equal(fanSavedCost.contributionMinor, 7150);
  assert.equal(fanSavedCost.valuation.lowContributionMinor, 2150);
  assert.equal(fanSavedCost.valuation.highContributionMinor, 10150);
  assert.equal(fanSavedCost.valuation.breakEvenUnits, 7);
  assert.equal(fanSavedCost.valuation.contributionCnyMinor, 2860);
  const fanHandoff = `${fanApi}/handoff?run=${fanRun}&market=MX`;
  await api(`${fanHandoff}&export=listing-json`, undefined, { status: 409 });
  await api(`${fanHandoff}&export=delivery-zip`, undefined, { status: 409 });
  assert.match((await api(fanHandoff)).suggestedListing.title, /Ventilador portátil recargable/);
  const fanWorksheet = await sheet(Buffer.from(await (await fetch(base + fanHandoff + "&export=channel")).arrayBuffer()));
  assert.equal(fanWorksheet.getCell("B2").value, "Mercado Libre México");
  assert.match(fanWorksheet.getCell("E2").value.hyperlink, /global-selling\.mercadolibre\.com/);
  const { state: preparedFan } = await api(fanHandoff, { type: "prepare", version: 0 });
  const es = preparedFan.agent.listing;
  assert.equal(es.title, "Ventilador portátil recargable");
  assert.match(es.description, /Dimensiones del producto: 15 × 8 × 4 cm/);
  assert.doesNotMatch(es.description, /mAh|certificado|[0-9]+\s*horas/);
  await api(fanHandoff, { type: "listing", version: preparedFan.version,
    listing: { title: es.title + " de viaje", description: es.description, sku: "QA-FAN-001" } });
  const fanDraft = await api(fanHandoff + "&export=listing-json");
  assert.equal(fanDraft.status, "draft");
  assert.equal(fanDraft.marketplace, "mercado_libre");
  assert.equal(fanDraft.locale, "es-MX");
  assert.equal(fanDraft.listing.sku, "QA-FAN-001");
  assert.match(fanDraft.listing.title, /de viaje$/);
  assert.equal(fanDraft.review.status, "review_required");
  const fanDelivery = await fetch(base + fanHandoff + "&export=delivery-zip");
  assert.equal(fanDelivery.status, 200);
  assert.match(fanDelivery.headers.get("content-type"), /application\/zip/);
  const fanBundle = await JSZip.loadAsync(await fanDelivery.arrayBuffer());
  assert.deepEqual(Object.keys(fanBundle.files).sort(), [
    "00-交付说明.txt", "01-出海研究报告.md", "02-渠道跟进.xlsx", "03-准入材料核对.xlsx",
    "04-上架草稿.json", "05-商品文案.txt", "06-单件测算.xlsx",
  ]);
  assert.equal(JSON.parse(await fanBundle.file("04-上架草稿.json").async("string")).listing.sku, "QA-FAN-001");
  const fanProfit = await sheet(await fanBundle.file("06-单件测算.xlsx").async("nodebuffer"));
  assert.equal(fanProfit.getCell("B10").value, 71.5);
  console.log("PASS  portable fan → Mercado Libre México report, dated comparables, MXN cost scenarios, edited es-MX draft and verified delivery ZIP");

  const isolated = await api(`${guidedApi}/handoff?run=${reportId}&market=JP`);
  assert.equal(isolated.state.files.length, 0);
  console.log("PASS  Agent draft → template mapping → shipment fields, selected SKU and freight PDF extraction → confirmed quote and trace (test fixtures)");

  const { jobId } = await api("/api/research/start", { productId: product.id, countries: ["UK"] }, { status: 202 });
  const jobPath = `/api/research/${jobId}`;
  await until(async () => (await api(jobPath)).job.status === "RUNNING", "research claimed", { ms: 10_000, interval: 25 });
  await stop(runner, "SIGKILL");
  assert.equal((await api(jobPath)).job.status, "RUNNING");
  runner = worker();
  const recovered = await until(async () => {
    assert.equal(runner.exitCode, null, "Worker exited during recovery");
    const result = await api(jobPath);
    return !["PENDING", "RUNNING"].includes(result.job.status) && result;
  }, "recovered research");
  assert.ok(["PARTIAL", "COMPLETED"].includes(recovered.job.status));
  assert.equal(recovered.job.attempts, 2);
  assert.ok(recovered.events.some(event => event.phase === "match"));
  const compliance = (await api(`${productApi}/compliance`)).compliance[0];
  assert.equal(compliance?.country, "UK");
  const live = compliance.officialSources.filter(source => source.status === "FETCHED" || source.status === "VERIFIED");
  if (process.env.REQUIRE_LIVE_SOURCE === "1") assert.ok(live.length, "No live official source could be fetched");
  console.log(`PASS  SIGKILL recovery → same job, attempt ${recovered.job.attempts}, ${recovered.job.status}, ${live.length} official sources fetched`);
  for (const source of live) console.log(`  SOURCE  ${source.url}`);

  await Promise.all([stop(server), stop(runner)]);
  server = start(["scripts/serve-localmate.mjs", "start", "-p", String(port)]);
  await ready();
  await until(async () => (await api(statusPath)).worker.online, "supervised worker readiness", { ms: 10_000 });
  assert.equal((await api(taskApi)).tasks.find(task => task.id === scout.id).status, "waiting");
  const csv = await fetch(`${base}${board}?draft=${draft.id}`);
  assert.equal(csv.status, 200);
  assert.equal(await fetch(base + reportPath).then(response => response.text()), reportText);
  if (process.env.LOCALMATE_REPORT_EXAMPLE_OUTPUT) {
    await writeFile(process.env.LOCALMATE_REPORT_EXAMPLE_OUTPUT,
      "这是一份生产验收示例。商品尺寸、采购价、重量和预算是测试输入。\n\n" + reportText, "utf8");
  }
  const channelFile = await csv.text();
  assert.match(channelFile, /^URL handle,Title,Description,Status,Published on online store/);
  assert.match(channelFile, /Organizador de escritorio.*artículos de oficina.*"draft","false"/s);
  const mxReview = await fetch(`${base}${board}?review=${approval.id}`).then(response => response.text());
  assert.match(mxReview, /\[x\] Scout/);
  assert.match(mxReview, /Listing draft \(es-MX/);
  console.log("PASS  Mexican Spanish starter → edited listing → buyer preview and draft-only Shopify CSV; UK English draft and counsel review packet");
  await api(evidenceApi, { id: observation.id }, { method: "DELETE" });
  const outdated = await fetch(`${base}${boardPage}&step=decide`).then(pageMarkup);
  const staleMexico = outdated.match(/<article[^>]*>(?:(?!<\/article>)[\s\S])*?墨西哥 · V[\s\S]*?<\/article>/)?.[0];
  assert.ok(staleMexico);
  assert.match(staleMexico, /输入已更新/);
  const current = (await api(board, { type: "generate", market: "MX" })).proposal.snapshot;
  assert.deepEqual(current.evidence, []);
  assert.equal(current.benchmark, undefined);
  assert.equal(current.benchmarkCostCurrent, false);
  console.log("PASS  restart preserves records and draft export; removed leads disappear from new proposals");
} finally {
  await Promise.all(children.map(child => stop(child)));
  await rm(temp, { force: true, recursive: true });
}
