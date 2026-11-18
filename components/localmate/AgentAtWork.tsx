import { Binoculars, Calculator, FileCheck2, Globe2, PencilLine } from "lucide-react";
import type { AgentName } from "@/lib/localmate/team-model";
import { AgentPose } from "./AgentPose";

const work = {
  Scout: { Icon: Binoculars, activity: "Scout 正在研究" },
  Margin: { Icon: Calculator, activity: "Margin 正在测算" },
  Guard: { Icon: FileCheck2, activity: "Guard 正在核对" },
  Localizer: { Icon: Globe2, activity: "Localizer 正在撰写" },
};

export function AgentAtWork({ agent, busy }: { agent: AgentName; busy: boolean }) {
  const { Icon, activity } = work[agent];
  return <div className="lm-agent-work" data-agent={agent} data-busy={busy}>
    <span className="lm-agent-work-scene" aria-hidden="true">
      <AgentPose agent={agent}/>
      <span className="lm-agent-work-desk"><Icon size={19}/></span>
      <span className="lm-agent-work-motion"><PencilLine size={17}/></span>
    </span>
    <span role="status">{busy ? activity : agent}</span>
  </div>;
}
