import Link from "next/link";
import { ArrowUpRight, FolderOpen, Plus } from "lucide-react";

const definitions = {
  products: ["商品档案", "查看商品资料、确认状态与缺失字段。"],
  market: ["市场研究", "选择项目，比较竞品并核对市场证据。"],
  compliance: ["合规中心", "选择商品与目标市场，核对准入材料和官方来源。"],
  launch: ["上架工作台", "打开已生成的草稿，或选择项目继续准备上架资料。"],
} as const;

export type DirectoryView = keyof typeof definitions;
export const isDirectoryView = (view: string | undefined): view is DirectoryView =>
  !!view && Object.hasOwn(definitions, view);

export function ModuleDirectory({ view, items }: { view: DirectoryView; items: { id: string; title: string; status: string; href: string; action: string; detail?: { label: string; href: string } }[] }) {
  const [title, description] = definitions[view];
  return <>
    <div className="lm-heading"><div><h1>{title}</h1><p>{description}</p></div>
      {view === "products" && <Link href="/workspace/import" className="lm-primary"><Plus size={17}/>导入商品</Link>}
    </div>
    <section aria-label={title} className="lm-panel">
      {items.length ? <ul className="lm-module-list">{items.map(item => <li key={item.id}>
        <div><h2>{item.title}</h2><small>{item.status}</small></div>
        <div>{item.detail && <Link className="lm-dash-link" href={item.detail.href}>{item.detail.label} <ArrowUpRight size={13}/></Link>}
          <Link className="lm-secondary" href={item.href}>{item.action} <ArrowUpRight size={15}/></Link></div>
      </li>)}</ul> : <div className="lm-project-empty"><span className="lm-project-icon"><FolderOpen size={22}/></span>
        <b>{view === "market" ? "暂无研究项目" : "暂无商品档案"}</b>
        <p>先填写出海目标或导入商品。</p><Link href="/#new-project" className="lm-primary">新建项目</Link>
      </div>}
    </section>
  </>;
}
