"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentPose } from "./AgentPose";
import type { AgentName } from "@/lib/localmate/team-model";

const profiles: Record<AgentName, { role: string; info: string; image: [number, number]; href: string }> = {
  Scout: { role: "市场研究", info: "查找目标市场与可比商品，整理售价、评价和可追溯的来源。", image: [553, 637], href: "/workspace?view=market" },
  Margin: { role: "利润测算", info: "根据已确认的售价、成本和汇率计算单件贡献，比较试卖方案。", image: [479, 657], href: "/workspace?view=board" },
  Guard: { role: "合规审核", info: "检查准入、标签和平台要求，列出需要补充的资料和人工复核事项。", image: [506, 652], href: "/workspace?view=compliance" },
  Localizer: { role: "本地化上架", info: "根据确认的商品资料起草本地文案及上架材料，供卖家审阅。", image: [554, 616], href: "/workspace?view=launch" },
};

type AgentCard = { agent: AgentName; status: string; state?: string; href?: string };

function AgentPortrait({ agent }: { agent: AgentName }) {
  const [width, height] = profiles[agent].image;
  return <Image src={`/localmate/v3/${agent.toLowerCase()}.png`} width={width} height={height} sizes="150px" alt="" data-portrait={agent.toLowerCase()} />;
}

export function DashboardAgents({ agents }: { agents: AgentCard[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<AgentCard>();
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);
  const profile = selected ? profiles[selected.agent] : undefined;
  return <section className="lm-panel lm-dash-agents" id="team" aria-labelledby="lm-agents-heading" data-home-card>
    <div className="lm-dash-head"><h2 id="lm-agents-heading">AI 全球商业团队</h2></div>
    <ul>{agents.map(item => <li key={item.agent} className="lm-agent-tile" data-agent={item.agent.toLowerCase()}>
      <Link className="lm-dash-agent" href={item.href ?? profiles[item.agent].href}
        aria-label={`${item.agent} · ${profiles[item.agent].role}`}>
        <AgentPose agent={item.agent} finished={item.agent === "Margin" || item.agent === "Localizer"}/>
        <strong>{item.agent}</strong>
        <small>{profiles[item.agent].role}</small>
        <span className={`lm-badge lm-${item.state ?? "idle"}`}>{item.status}</span>
      </Link>
      <button className="lm-agent-info" type="button" aria-haspopup="dialog" aria-label={`查看 ${item.agent} 职责`} onClick={() => setSelected(item)}>
        <Info size={15} aria-hidden/>
      </button>
    </li>)}</ul>
    <dialog ref={dialog} className="lm-dash-dialog" aria-labelledby="lm-agent-dialog-title" onClose={() => setSelected(undefined)}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
          event.currentTarget.close();
        }
      }}>
      {selected && profile && <>
        <div className="lm-dash-head"><h2 id="lm-agent-dialog-title">{selected.agent} · {profile.role}</h2>
          <form method="dialog"><button className="lm-icon-button" aria-label="关闭职责"><X size={18}/></button></form>
        </div>
        <div className="lm-dash-dialog-body"><AgentPortrait agent={selected.agent}/><div><span className={`lm-badge lm-${selected.state ?? "idle"}`}>{selected.status}</span><p>{profile.info}</p>
          <Link className="lm-secondary" href={selected.href ?? profile.href} onClick={() => dialog.current?.close()}>{`打开${profile.role}`} <ArrowUpRight size={15}/></Link>
        </div></div>
      </>}
    </dialog>
  </section>;
}
