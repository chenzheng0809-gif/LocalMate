/**
 * Responsive QA over the Chrome DevTools Protocol.
 *
 * The in-app browser panel is narrower than a real desktop, so viewport widths
 * are emulated explicitly here. Usage:
 *
 *   npx tsx scripts/qa-responsive.ts [path ...]
 *
 * With no arguments it checks the warm home, the agent workspace and the
 * passport document at 1440 / 900 / 390 px. Screenshots land in
 * `data/qa-screens/`. Exits non-zero when a page overflows horizontally or
 * logs a console error.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.resolve("data/qa-screens");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 900, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

type Target = { url: string; webSocketDebuggerUrl: string; id: string; type?: string };

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return (await response.json()) as T;
}

async function waitForChrome(): Promise<Target> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const list = await fetchJson<Target[]>(`http://127.0.0.1:${PORT}/json/list`);
      const page = list.find((entry) => entry.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // chrome is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Chrome DevTools endpoint did not become available.");
}

class Cdp {
  private socket!: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  readonly consoleErrors: string[] = [];

  async connect(url: string): Promise<void> {
    this.socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      this.socket.addEventListener("open", () => resolve(), { once: true });
      this.socket.addEventListener("error", () => reject(new Error("CDP socket error")), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
        method?: string;
        params?: { entry?: { text?: string; level?: string }; exceptionDetails?: { text?: string } };
      };
      if (message.id !== undefined) {
        const entry = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (!entry) return;
        if (message.error) entry.reject(new Error(message.error.message));
        else entry.resolve(message.result);
        return;
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params?.entry?.level === "error") {
        this.consoleErrors.push(message.params.entry.text ?? "console error");
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.consoleErrors.push(message.params?.exceptionDetails?.text ?? "uncaught exception");
      }
    });
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 45000);
    });
  }

  close(): void {
    this.socket.close();
  }
}

async function evaluate<T>(cdp: Cdp, expression: string): Promise<T> {
  const result = (await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })) as { result?: { value?: T } };
  return result.result?.value as T;
}

async function run(): Promise<void> {
  if (!existsSync(CHROME)) {
    console.error(`Chrome not found at ${CHROME}. Install Chrome or set QA_CHROME.`);
    process.exitCode = 1;
    return;
  }
  await mkdir(OUT_DIR, { recursive: true });

  const profile = path.join("/tmp", "pp-qa-profile");
  const chrome: ChildProcess = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let failures = 0;
  try {
    const target = await waitForChrome();
    const cdp = new Cdp();
    await cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const paths = process.argv.slice(2);
    const routes = paths.length > 0 ? paths : ["/", "/agent/prod_a51e55e8dfaf4cec9ef19989", "/passport/prod_a51e55e8dfaf4cec9ef19989"];
    const productId = process.env.QA_PRODUCT_ID ?? "prod_a2c119f4ec424081be724630";

    for (const route of routes) {
      const resolved = route.includes(":product:") ? route.replace(":product:", productId) : route;
      for (const viewport of VIEWPORTS) {
        cdp.consoleErrors.length = 0;
        await cdp.send("Emulation.setDeviceMetricsOverride", {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 2,
          mobile: viewport.width < 768,
        });
        await cdp.send("Page.navigate", { url: `${BASE}${resolved}` });
        await new Promise((resolve) => setTimeout(resolve, 2600));
        await evaluate(cdp, "document.fonts ? document.fonts.ready.then(() => true) : true");

        const metrics = await evaluate<{
          scrollWidth: number;
          clientWidth: number;
          title: string;
          textLength: number;
        }>(
          cdp,
          `(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            title: document.title,
            textLength: (document.body.innerText || '').length,
          }))()`,
        );

        if (process.env.QA_PRINT_TEXT === "1") {
          const excerpt = await evaluate<string>(
            cdp,
            `(document.body.innerText || '').replace(/\\n{2,}/g, '\\n').slice(0, 1800)`,
          );
          console.log(`---- text @ ${viewport.name} ${resolved} ----\n${excerpt}\n----`);
        }

        if (process.env.QA_SCROLL === "1") {
          await evaluate(
            cdp,
            `(() => {
              const nodes = Array.from(document.querySelectorAll('*'));
              const scroller = nodes.find((node) => {
                const style = getComputedStyle(node);
                return (style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 40;
              });
              if (scroller) { scroller.scrollTop = scroller.scrollHeight; return 'scrolled'; }
              window.scrollTo(0, document.body.scrollHeight);
              return 'window';
            })()`,
          );
          await new Promise((resolve) => setTimeout(resolve, 700));
        }

        const overflow = metrics.scrollWidth > metrics.clientWidth + 1;
        const file = path.join(OUT_DIR, `${route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}-${viewport.name}.png`);
        const shot = (await cdp.send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: process.env.QA_FULL_PAGE === "1",
        })) as {
          data: string;
        };
        await writeFile(file, Buffer.from(shot.data, "base64"));

        const problems: string[] = [];
        if (overflow) problems.push(`horizontal overflow ${metrics.scrollWidth}px > ${metrics.clientWidth}px`);
        if (metrics.textLength < 120) problems.push(`page looks empty (${metrics.textLength} chars)`);
        if (cdp.consoleErrors.length > 0) problems.push(`console errors: ${cdp.consoleErrors.slice(0, 3).join(" | ")}`);

        if (problems.length > 0) failures += 1;
        console.log(
          `${problems.length === 0 ? "PASS" : "FAIL"}  ${viewport.name.padEnd(7)} ${String(viewport.width).padStart(4)}px  ${resolved}  ${problems.length > 0 ? problems.join("; ") : "no overflow, content rendered"}`,
        );
      }
    }
    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
  }
  if (failures > 0) {
    console.error(`\n${failures} viewport check(s) reported problems.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll viewport checks passed.");
  }
}

void run();
