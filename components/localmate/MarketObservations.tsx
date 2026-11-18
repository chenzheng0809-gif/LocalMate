"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client/api";
import type { Observation } from "@/lib/localmate/observations";

export function MarketObservations({ missionId, markets, observations }: {
  missionId: string;
  markets: { code: string; name: string }[];
  observations: Observation[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const path = `/api/localmate/missions/${missionId}/evidence`;
  async function change(method: "POST" | "DELETE", input: Record<string, unknown>, form?: HTMLFormElement) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, { method, body: JSON.stringify(input) });
      form?.reset();
      setMessage(method === "POST" ? "已保存为待核验线索。" : "已移除观察记录。");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void change("POST", Object.fromEntries(new FormData(form)), form);
  }

  return <section className="lm-panel lm-form" id="market-observations">
    <h2>添加市场来源</h2>
    <p>保存你看到的商品、售价或评论原文及出处。记录会标为待核验线索，可供 Scout 整理。</p>
    {markets.length ? <form className="lm-form" onSubmit={save}>
      <label>目标市场<select name="market" required>{markets.map(market => <option key={market.code} value={market.code}>{market.name}</option>)}</select></label>
      <label>原始链接<input name="url" type="url" required maxLength={2048} placeholder="https://…" /></label>
      <label>来源标题<input name="title" required minLength={2} maxLength={200} /></label>
      <label>实际观察日期<input name="observedAt" type="date" required /></label>
      <label>原文或观察记录<textarea name="excerpt" required minLength={3} maxLength={1200} rows={3} placeholder="抄录所见信息，并注明币种和计数口径。" /></label>
      <button className="lm-secondary" disabled={busy}>保存来源</button>
    </form> : <p>先在研究计划中保存目标市场。</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="lm-error">{error}</p>}
    {observations.length ? <ul className="lm-list">{observations.map(item => <li key={item.id}>
      <a className="lm-link" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
      <small>{markets.find(market => market.code === item.market)?.name ?? item.market} · {item.observedAt} · 用户提供 · 待核验{!item.productId && " · 筛选阶段"}</small>
      <p>{item.excerpt}</p>
      <button className="lm-secondary" type="button" disabled={busy} onClick={() => void change("DELETE", { id: item.id })}>移除</button>
    </li>)}</ul> : null}
  </section>;
}
