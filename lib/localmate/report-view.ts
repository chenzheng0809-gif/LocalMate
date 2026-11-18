import { marketSamples, rankedMarketSamples, sampleDescription } from "./market-samples";
import { taskResultText } from "./status-copy";
import { aiModeLabel, agents, type TeamTask } from "./team-model";
import { markets } from "./mission-model";
import { reportMarkets, type ReportMarket } from "./report-model";
import { handoffChannel } from "./handoff-channels";

export const reportModules = { Scout: "市场和渠道", Margin: "价格和物流", Guard: "准入材料", Localizer: "商品本地化" };

export function reportTasks(tasks: TeamTask[], requestId?: string) {
  const picked = requestId ?? tasks.find(task => task.report)?.requestId;
  return picked ? tasks.filter(task => task.requestId === picked && task.report) : [];
}

export function reportSummary(tasks: TeamTask[]) {
  const first = tasks[0];
  if (!first?.report) return null;
  const done = tasks.length === agents.length && tasks.every(task => !["queued", "running"].includes(task.status));
  const roles = agents.map(agent => ({ agent, task: tasks.find(task => task.agent === agent) }));
  const input = first.report;
  const marketRows = first.markets.filter((code): code is ReportMarket => reportMarkets.some(market => market === code)).map(code => ({
    code, name: markets.find(market => market.code === code)?.name ?? code,
    channel: handoffChannel(code, first.report?.mexicoMarketplace),
    outputs: roles.map(({ agent, task }) => {
      const result = task?.status === "completed" ? task.result : null;
      const section = result?.sections?.find(section => section.market === code);
      const known = agent === "Scout" ? marketSamples(input.name, code) : [];
      const ranked = section && known.length ? rankedMarketSamples(input.name, code) : [];
      const evidence = result?.evidence?.filter(item => item.market === code && !known.some(sample => sample.url === item.url)) ?? [];
      const lines = section?.lines.filter(line => !known.some(item => line.startsWith(`${item.title} ·`)) &&
        !line.startsWith("来自导入快照，样本并非随机抽样")) ?? [];
      return {
        agent,
        section: section && { ...section, lines: [...lines.map(line => taskResultText(line, agent === "Guard")),
          ...ranked.map(item => `${item.title} · ${sampleDescription(item)}`)] },
        evidence: [...ranked.map(item => ({ title: item.title, url: item.url, market: code, note: sampleDescription(item) })), ...evidence],
        nextAction: result?.nextAction,
      };
    }),
  }));
  return { input: first.report, done, roles, markets: marketRows };
}

export function reportMarkdown(report: NonNullable<ReturnType<typeof reportSummary>>) {
  const { input } = report;
  return [
    `# ${input.name} · 出海研究报告`, "",
    `商品 ${input.dimensions} · 单品包装 ${input.packagingDimensions} · 含包装 ${input.weightKg} kg`, "",
    ...report.roles.flatMap(({ agent, task }) => {
      const mode = task?.result?.aiMode;
      const nextAction = task?.result?.nextAction;
      return mode ? [`- ${agent} · ${aiModeLabel(mode)}${nextAction ? `：${nextAction}` : ""}`] : [];
    }), "",
    ...report.markets.flatMap(market => [
      `## ${market.name} · ${market.channel.name}`, "",
      `- [申请入口](${market.channel.apply})`, `- [官方注册要求](${market.channel.guide})`, `- [官方客服入口](${market.channel.contact})`, "",
      ...(market.channel.id === "mercado_libre" ? [
        "### 竞品快照与测算口径",
        ...market.outputs.filter(output => output.agent === "Scout" || output.agent === "Margin").flatMap(output => [
          ...(output.section?.lines ?? []).map(line => `- ${line}`),
          ...output.evidence.map(item => `- [${item.title}](${item.url})${item.note ? ` · ${item.note}` : ""}`),
        ]),
        "",
      ] : []),
      "### 准入资料与来源",
      ...market.outputs.filter(output => output.agent === "Guard").flatMap(output => [
        ...(output.section?.lines ?? []).map(line => `- ${line}`),
        ...output.evidence.map(item => `- [${item.title}](${item.url})`),
      ]), "",
      "### 商品文案草稿",
      ...market.outputs.find(output => output.agent === "Localizer")?.section?.lines.filter(line => /^(标题|首屏文案)：/.test(line)) ?? [],
      "",
      "渠道跟进表、上架模板、询价与回单、买家报价和准入材料包可在本项目交付区下载。", "",
    ]),
  ].join("\n");
}
