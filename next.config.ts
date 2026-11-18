import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Running the dev server must not overwrite a verified production build.
  distDir: process.env.NODE_ENV === "development" ? ".next" : ".next-production",
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/passport-home", destination: "/", permanent: true }];
  },
  serverExternalPackages: ["cheerio", "exceljs", "pdfkit", "pdf-parse", "nodemailer", "jszip"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;