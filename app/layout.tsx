import type { Metadata } from "next";
import "./globals.css";
import "./workbench.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { publicConfigInfo } from "@/lib/config";

export const metadata: Metadata = {
  title: "LocalMate｜AI 出海工作台",
  description:
    "从商品或目标市场开始，研究证据、测算成本并推进出海项目。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const config = publicConfigInfo();
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <div className="pointer-events-none fixed inset-0 z-0 grid-overlay opacity-60" aria-hidden />
        <div className="relative z-10">
          <Header
            appMode={config.appMode}
            searchMode={config.search.mode}
            aiConfigured={config.ai.configured}
            aiModel={config.ai.model}
          />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
