export {};

import { DatabaseSync } from "node:sqlite";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

type Json = Record<string, unknown>;

async function request(path: string, init?: RequestInit): Promise<{ status: number; data: Json }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  let data: Json = {};
  try {
    data = text ? (JSON.parse(text) as Json) : {};
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: response.status, data };
}

let failures = 0;
function check(name: string, condition: boolean, detail: string) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!condition) failures += 1;
}

const systemResponse = await request("/api/system/status");
check("system status", systemResponse.status === 200 && Boolean(systemResponse.data.appMode), `HTTP ${systemResponse.status}, mode=${String(systemResponse.data.appMode)}`);
check("no client secret", !JSON.stringify(systemResponse.data).toLowerCase().includes("apikey"), "status payload contains no apiKey field");

const seeded = await request("/api/demo/seed", { method: "POST", body: "{}" });
const product = (seeded.data.product ?? {}) as { id?: string };
check("demo seed", seeded.status === 201 && Boolean(product.id), `HTTP ${seeded.status}, product=${product.id ?? "missing"}`);

if (product.id) {
  const fetched = await request(`/api/products/${product.id}`);
  check("product fetch", fetched.status === 200 && Boolean(fetched.data.product), `HTTP ${fetched.status}`);

  const markets = await request(`/api/products/${product.id}/markets`);
  check("markets endpoint", markets.status === 200 && Array.isArray(markets.data.markets), `HTTP ${markets.status}`);

  const invalid = await request("/api/products", { method: "POST", body: JSON.stringify({ name: "x" }) });
  check("validation error", invalid.status === 422 && invalid.data.code === "VALIDATION_ERROR", `HTTP ${invalid.status}`);
}

const missing = await request("/api/products/prod_missing");
check("missing product 404", missing.status === 404, `HTTP ${missing.status}`);

if (product.id) {
  const db = new DatabaseSync(process.env.DATABASE_PATH ?? "data/product-passport.db");
  db.prepare("DELETE FROM products WHERE id = ?").run(product.id);
  db.close();
  console.log("CLEANUP  removed smoke-test product");
}

console.log(`\n${failures === 0 ? "Smoke checks passed." : `${failures} smoke check(s) failed.`}`);
if (failures > 0) process.exit(1);
