import Image from "next/image";
import type { AgentName } from "@/lib/localmate/team-model";

export function AgentAvatar({ agent }: { agent: AgentName }) {
  return <span className="lm-avatar"><Image src={`/localmate/${agent.toLowerCase()}-approved.png`} alt="" width={56} height={56}/></span>;
}

