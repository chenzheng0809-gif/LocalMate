"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Method } from "@/lib/localmate/method-model";
import { send, useOperation } from "./MissionActions";

export function MethodLibrary({ methods, initialInstructions }: { methods: Method[]; initialInstructions?: string }) {
  const router = useRouter();
  const { busy, error, run } = useOperation();
  const [editing, setEditing] = useState<Method | "new" | null>(initialInstructions ? "new" : null);
  const current = typeof editing === "object" ? editing : null;
  function change(action: () => Promise<unknown>) {
    void run(async () => {
      try {
        await action();
        setEditing(null);
      } finally {
        router.refresh();
      }
    });
  }
  return <section className="lm-panel">
    <div className="lm-section-heading">
      <div><h2>我的做法</h2><p>保存常用步骤和要求，交给团队时直接选用。</p></div>
      <button type="button" className="lm-primary" disabled={busy} onClick={() => setEditing("new")}>新增做法</button>
    </div>
    {editing && <form key={current?.id ?? "new"} className="lm-form" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const fields = { name: data.get("name"), scope: data.get("scope"), instructions: data.get("instructions") };
      change(() => current
        ? send(`/api/localmate/methods/${current.id}`, "PATCH", { revision: current.revision, fields })
        : send("/api/localmate/methods", "POST", fields));
    }}>
      <label>名称<input name="name" defaultValue={current?.name} required maxLength={80} /></label>
      <label>什么时候用<input name="scope" defaultValue={current?.scope} required maxLength={240} /></label>
      <label>怎么做、交付什么<textarea name="instructions" defaultValue={current?.instructions ?? initialInstructions} required maxLength={2400} rows={4} /></label>
      <div className="lm-actions"><button className="lm-primary" disabled={busy}>保存做法</button>
        <button type="button" className="lm-link" disabled={busy} onClick={() => setEditing(null)}>取消</button></div>
    </form>}
    {error && <p className="lm-error" role="alert">{error}</p>}
    {methods.length ? <ul className="lm-list">{methods.map(method => <li key={method.id}>
      <div className="lm-actions"><b>{method.name}</b>{!method.enabled && <small>已停用</small>}
        <button type="button" className="lm-link" disabled={busy} onClick={() => setEditing(method)}>编辑</button>
        <button type="button" className="lm-link" disabled={busy} onClick={() => change(() => send(
          `/api/localmate/methods/${method.id}`, "PATCH", { revision: method.revision, enabled: !method.enabled },
        ))}>{method.enabled ? "停用" : "启用"}</button></div>
      <small>{method.scope}</small>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{method.instructions}</p>
    </li>)}</ul> : <p>暂无做法。</p>}
  </section>;
}
