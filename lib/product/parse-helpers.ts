import { parseMoney } from "@/lib/utils/money";

export function extractMoneyFromText(text: string): number | null {
  if (!text) return null;
  const matches = text.match(/(?:¥|￥|CNY|RMB|元)\s*([0-9][0-9,.]*)/i);
  if (matches) {
    const value = parseMoney(matches[1], "CNY");
    if (value !== null && value > 0.01) return value;
  }
  return null;
}
