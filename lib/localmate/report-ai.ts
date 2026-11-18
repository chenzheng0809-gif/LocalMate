import { z } from "zod";
import { AIError, type AIProvider, type UsageHandler } from "@/lib/ai/types";
import { AppError } from "@/lib/errors";
import type { TaskResult, TeamTask } from "./team-model";

const scoutActions = {
  verify_comparables: "打开竞品来源，核对规格、套装数量和价格日期。",
  collect_comparables: "补充同规格商品页，记录链接、价格和采集日期。",
  verify_channel: "查阅报告中的渠道入口，确认类目及可用的卖家路径。",
};
const marginActions = {
  freight: "用实际包装重量和尺寸取得一份运费报价，再更新测算。",
  fees: "核对目标站点的佣金及收款费用，再更新测算。",
  stress: "用利润测算页的保守情景核对单件贡献和可承受的试卖规模。",
};
const guardActions = {
  specifications: "整理实物规格、材质及使用说明，供专业人员核对适用要求。",
  authority: "提交官方来源和商品资料，请专业人员核对适用法规。",
  platform: "请平台确认商品类目与上架材料，并保存平台的书面回复。",
};
const localizerActions = {
  dimensions: "先核对标题和详情中的商品尺寸与单位。",
  package: "先核对草稿中的实际发货件数和包装内容。",
  translation: "请当地译审核对标题、用途和规格表达。",
};

async function select<T extends string>(ai: AIProvider, input: {
  role: TeamTask["agent"]; schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  field: string; actions: Record<T, string>; context: string; usage: UsageHandler;
}) {
  const result = await ai.generateStructured({
    schema: z.object({ [input.field]: input.schema }).strict().transform(value => value[input.field]),
    schemaName: `${input.role}ReportAdvice`,
    schemaHint: `Exactly one key "${input.field}", whose value is one of these strings: ${Object.keys(input.actions).join(", ")}. Example JSON: ${JSON.stringify({ [input.field]: Object.keys(input.actions)[0] })}`,
    system: "为出海评估选择一个优先动作。JSON 值必须是字符串，只填所选动作的键，不填中文描述。仅根据工作记录选择，不补充事实，不改变市场、利润或准入结论。",
    prompt: `优先动作（键及含义）：${JSON.stringify(input.actions)}\n工作记录：${input.context}`,
    operation: `localmate.report.${input.role.toLowerCase()}`,
    usage: input.usage,
    maxTokens: 256,
    temperature: 0.1,
    maxRepairAttempts: 1,
  });
  return input.actions[result];
}

export async function addReportAdvice(ai: AIProvider | null, task: TeamTask, result: TaskResult, usage: UsageHandler): Promise<TaskResult> {
  if (!ai) return { ...result, aiMode: "DEMO" };
  try {
    const context = JSON.stringify({
      scope: task.markets,
      instruction: task.instruction,
      output: result.details,
      listingSources: result.evidence?.map(({ title, market }) => ({ title, market })),
      sections: result.sections?.map(({ market, title, lines, marketSignal, releaseHold, economics }) =>
        ({ market, title, lines, marketSignal, releaseHold, economics })),
    }).slice(0, 7000);
    const common = { role: task.agent, context, usage };
    const nextAction = await ({
      Scout: () => select(ai, { ...common, field: "evidencePriority", actions: scoutActions,
        schema: z.enum(["verify_comparables", "collect_comparables", "verify_channel"]) }),
      Margin: () => select(ai, { ...common, field: "costPriority", actions: marginActions,
        schema: z.enum(["freight", "fees", "stress"]) }),
      Guard: () => select(ai, { ...common, field: "reviewPriority", actions: guardActions,
        schema: z.enum(["specifications", "authority", "platform"]) }),
      Localizer: () => select(ai, { ...common, field: "copyPriority", actions: localizerActions,
        schema: z.enum(["dimensions", "package", "translation"]) }),
    })[task.agent]();
    return { ...result, aiMode: "LIVE", nextAction };
  } catch (error) {
    console.warn("[localmate report] AI fallback", task.agent, error instanceof AIError || error instanceof AppError ? error.code : "UNEXPECTED");
    return { ...result, aiMode: "FALLBACK" };
  }
}
