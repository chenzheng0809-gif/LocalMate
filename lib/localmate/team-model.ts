import { taskStatusCopy } from "./status-copy";
import type { ReportInput, ReportSection } from "./report-model";
import type { CompliancePrecheck } from "./compliance-kb";
import type { MethodSnapshot } from "./method-model";

export const GB_PREFLIGHT_INSTRUCTION = "@Guard 核查英国 Amazon UK 桌面收纳合规";

export const agents = ["Scout", "Margin", "Guard", "Localizer"] as const;
export type AgentName = typeof agents[number];
export const modules: Record<AgentName, string> = {
  Scout: "市场研究", Margin: "利润测算", Guard: "合规与风险", Localizer: "本土化方案",
};
export const taskLabels = {
  queued: taskStatusCopy.notStarted, running: "执行中", completed: taskStatusCopy.completed, waiting: taskStatusCopy.needsInformation, failed: "执行失败",
};
export type TeamTask = {
  id: string;
  missionId: string;
  requestId?: string;
  report?: ReportInput;
  agent: AgentName;
  title: string;
  instruction: string;
  method?: MethodSnapshot;
  markets: string[];
  status: keyof typeof taskLabels;
  createdAt: string;
  updatedAt: string;
  result: TaskResult | null;
};
export type TaskResult = {
  summary: string;
  details?: string[];
  evidence?: { title: string; url: string; market?: string; note?: string; origin?: "USER_INPUT" | "OPENAI_WEB_SEARCH" }[];
  link?: string;
  compliancePrecheck?: CompliancePrecheck;
  sections?: ReportSection[];
  aiMode?: "LIVE" | "DEMO" | "FALLBACK";
  nextAction?: string;
};
export const aiModeLabel = (mode: NonNullable<TaskResult["aiMode"]>) => ({
  LIVE: "AI 辅助", DEMO: "演示模式", FALLBACK: "AI 暂不可用 · 规则结果",
})[mode];
export type ProjectFile = { name: string; data: string };
export function currentTask(tasks: TeamTask[], agent: AgentName) {
  const matching = tasks.filter(task => task.agent === agent);
  return matching.find(task => task.status === "running") ?? matching.find(task => task.status === "queued") ?? matching[0];
}

export function projectProgress(tasks: TeamTask[]) {
  const current = agents.flatMap(agent => currentTask(tasks, agent) ?? []);
  const done = current.filter(task => task.status === "completed").length;
  const status = current.find(task => task.status === "running")?.status ??
    current.find(task => task.status === "queued")?.status ??
    current.find(task => task.status === "failed")?.status ??
    current.find(task => task.status === "waiting")?.status;
  return { status: status ? taskLabels[status] : done ? taskLabels.completed : taskLabels.queued, state: status, done, total: current.length };
}

export function currentGbPrecheck(tasks: TeamTask[], product: { id: string; updatedAt: string; confirmed: boolean }) {
  if (!product.confirmed) return undefined;
  return tasks.find(({ result }) =>
    result?.compliancePrecheck?.productId === product.id &&
    result.compliancePrecheck.productUpdatedAt === product.updatedAt,
  )?.result?.compliancePrecheck;
}
