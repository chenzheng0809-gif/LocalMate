import { nowIso, uid, type AppDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import type { Method, MethodFields, MethodUpdate } from "./method-model";

function fromRow(row: Record<string, unknown>): Method {
  return {
    id: String(row.id), name: String(row.name), scope: String(row.scope),
    instructions: String(row.instructions), revision: Number(row.revision),
    enabled: row.enabled === 1,
  };
}

export function createMethodRepository(db: AppDatabase) {
  function get(id: string) {
    const row = db.prepare("SELECT * FROM localmate_methods WHERE id = ?").get(id);
    if (!row) throw new AppError("找不到这条做法。", { status: 404 });
    return fromRow(row);
  }

  return {
    get,
    list() {
      return db.prepare("SELECT * FROM localmate_methods ORDER BY updated_at DESC, id DESC").all().map(fromRow);
    },
    create(fields: MethodFields) {
      const id = uid("method");
      db.prepare("INSERT INTO localmate_methods (id, name, scope, instructions, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(id, fields.name, fields.scope, fields.instructions, nowIso());
      return get(id);
    },
    update(id: string, update: MethodUpdate) {
      const current = get(id);
      const fields = update.fields ?? current;
      const changed = db.prepare(`UPDATE localmate_methods SET name = ?, scope = ?, instructions = ?,
        enabled = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING *`)
        .get(fields.name, fields.scope, fields.instructions, Number(update.enabled ?? current.enabled), nowIso(), id, update.revision);
      if (!changed) throw new AppError("做法已更新，请刷新后重试。", { status: 409 });
      return fromRow(changed);
    },
  };
}
