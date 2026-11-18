import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL } from "@/lib/db/schema";

import { HANDOFF_SQL, LOCALMATE_PHASE1_SQL } from "@/lib/localmate/schema";

export type AppDatabase = DatabaseSync;

declare global {
  var __productPassportDb: AppDatabase | undefined;
}

const initializedLocalMate = new WeakSet<AppDatabase>();

function ensureLocalMateSchema(db: AppDatabase): void {
  if (initializedLocalMate.has(db)) return;
  db.exec(LOCALMATE_PHASE1_SQL);
  db.exec(HANDOFF_SQL);
  initializedLocalMate.add(db);
}

export function openDatabase(databasePath: string): AppDatabase {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA_SQL);
  ensureLocalMateSchema(db);
  return db;
}

export function getDb(): AppDatabase {
  if (!globalThis.__productPassportDb) {
    const databasePath = path.resolve(
      process.cwd(),
      process.env.DATABASE_PATH ?? "data/product-passport.db",
    );
    globalThis.__productPassportDb = openDatabase(databasePath);
  }
  ensureLocalMateSchema(globalThis.__productPassportDb);
  return globalThis.__productPassportDb;
}

/** Used by tests and scripts to avoid the process-wide singleton. */
export function createTestDb(): AppDatabase {
  return openDatabase(":memory:");
}

export function resetDbSingleton(): void {
  globalThis.__productPassportDb?.close();
  globalThis.__productPassportDb = undefined;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uid(prefix = ""): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return prefix ? `${prefix}_${id.replace(/-/g, "").slice(0, 24)}` : id;
}