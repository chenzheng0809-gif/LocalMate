import type {
  ComplianceData,
  Country,
  LaunchPageContent,
  MatchAnalysis,
  PassportSnapshot,
  ProductDNA,
  SimulationResult,
} from "@/types/domain";

export type AgentView =
  | "overview"
  | "product"
  | "markets"
  | "compliance"
  | "simulation"
  | "launch"
  | "passport";

export interface AgentSource {
  title: string;
  url: string;
  note?: string;
}

export interface AgentCard {
  title: string;
  subtitle?: string;
  lines: string[];
  chips?: string[];
}

export interface AgentReply {
  reply: string;
  view: AgentView;
  country?: Country | null;
  card?: AgentCard | null;
  sources?: AgentSource[];
  nextActions?: string[];
  progressJobId?: string | null;
  confirmRequired?: boolean;
  product?: ProductDNA;
  marketCount?: number;
  complianceCount?: number;
  launch?: LaunchPageContent | null;
  simulation?: SimulationResult | null;
  passport?: PassportSnapshot | null;
  match?: MatchAnalysis | null;
  compliance?: ComplianceData | null;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  card?: AgentCard | null;
  sources?: AgentSource[];
  nextActions?: string[];
  pending?: boolean;
  createdAt: string;
}
