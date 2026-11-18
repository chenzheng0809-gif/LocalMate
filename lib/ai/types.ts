import type { z } from "zod";
import type { ImageAnalysisResult } from "@/schemas/product";

export interface AIUsage {
  provider: string;
  model: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  requestId: string | null;
}

export type UsageHandler = (usage: AIUsage) => void | Promise<void>;

export interface ImageInput {
  /** data:image/...;base64,... or a public https URL */
  url: string;
  detail?: "auto" | "low" | "high";
}

export interface GenerateTextInput {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  images?: ImageInput[];
  operation?: string;
  usage?: UsageHandler;
  signal?: AbortSignal;
}

export interface StructuredInput<T> extends GenerateTextInput {
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  schemaName: string;
  /** Human/LLM readable JSON shape hint. */
  schemaHint: string;
  maxRepairAttempts?: number;
}

export interface ImageAnalysisInput {
  images: ImageInput[];
  prompt: string;
  system?: string;
  operation?: string;
  usage?: UsageHandler;
  signal?: AbortSignal;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolCallResult {
  text: string;
  toolCalls: ToolCall[];
  usage: AIUsage;
}

export interface AIProvider {
  readonly info: {
    provider: string;
    model: string;
    visionModel: string;
    capabilities: {
      text: boolean;
      json: boolean;
      vision: boolean;
      tools: boolean;
    };
  };

  generateText(input: GenerateTextInput): Promise<string>;

  generateStructured<T>(input: StructuredInput<T>): Promise<T>;

  analyzeImage?(input: ImageAnalysisInput): Promise<ImageAnalysisResult>;

  callTools?(
    input: GenerateTextInput & { tools: ToolDefinition[]; toolChoice?: "auto" | "none" },
  ): Promise<ToolCallResult>;
}

export class AIError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { code?: string; status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "AIError";
    this.code = options.code ?? "AI_ERROR";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export class AISchemaError extends AIError {
  readonly rawOutput: string;
  readonly validationIssues: string[];

  constructor(message: string, rawOutput: string, validationIssues: string[] = []) {
    super(message, { code: "AI_SCHEMA_INVALID" });
    this.name = "AISchemaError";
    this.rawOutput = rawOutput;
    this.validationIssues = validationIssues;
  }
}

export class AINotConfiguredError extends AIError {
  constructor() {
    super("AI 服务未配置，或当前启用了演示模式。", {
      code: "AI_NOT_CONFIGURED",
    });
    this.name = "AINotConfiguredError";
  }
}

