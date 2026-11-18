import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const [mode, ...args] = process.argv.slice(2);
if (!["dev", "start"].includes(mode)) throw new Error("Expected dev or start.");
const env = { ...process.env, NODE_ENV: mode === "dev" ? "development" : "production" };
const cwd = fileURLToPath(new URL("../", import.meta.url));
const next = spawn(process.execPath, [require.resolve("next/dist/bin/next"), mode, "--hostname", "127.0.0.1", "-p", "3000", ...args], { cwd, env, stdio: "inherit" });
const worker = spawn(process.execPath, ["--import", "tsx", "scripts/workflow-worker.ts"], { cwd, env, stdio: "inherit" });
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of [next, worker]) child.kill("SIGTERM");
  const deadline = setTimeout(() => {
    for (const child of [next, worker]) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  }, 10_000);
  deadline.unref();
}
for (const child of [next, worker]) {
  child.on("error", error => { console.error(error); stop(1); });
  child.on("exit", code => stop(code ?? 1));
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
