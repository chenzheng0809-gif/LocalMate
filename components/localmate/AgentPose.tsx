import Image from "next/image";
import type { AgentName } from "@/lib/localmate/team-model";

export function AgentPose({ agent, finished = false }: { agent: AgentName; finished?: boolean }) {
  return <span className="lm-agent-pose" data-agent={agent} data-finished={finished} aria-hidden="true">
    <Image src={`/localmate/${agent.toLowerCase()}-poses.webp`} alt="" width={480} height={360} unoptimized/>
  </span>;
}
