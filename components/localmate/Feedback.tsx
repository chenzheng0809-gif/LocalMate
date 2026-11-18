import Link from "next/link";
import { CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";

export function LocalMateLoading() {
  return <div className="lm-shell"><div className="lm-panel lm-feedback" role="status">
    <LoaderCircle size={22} className="lm-spinner"/><h2>正在加载工作台</h2><p>正在读取项目、顾问任务与方案。</p>
  </div></div>;
}

export function LocalMateError({ retry }: { retry: () => void }) {
  return <div className="lm-shell"><div className="lm-panel lm-feedback" role="alert">
    <CircleAlert size={22}/><h2>工作台暂时无法加载</h2>
    <div className="lm-actions"><button className="lm-primary" type="button" onClick={retry}><RotateCcw size={16}/>重试</button>
      <Link className="lm-secondary" href="/">返回首页</Link></div>
  </div></div>;
}
