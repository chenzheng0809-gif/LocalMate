const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  CNY: "zh-CN",
};

export function currencySymbol(currency: string): string {
  switch (currency) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    case "CNY":
      return "¥";
    default:
      return currency;
  }
}

export function parseMoney(raw: string | null | undefined, currency?: string): number | null {
  if (!raw) return null;
  let text = raw
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(/[^\d.,-]/g, "");
  if (!text) return null;

  if (currency === "JPY") {
    const parsed = Number(text.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    const segments = text.split(",");
    const last = segments[segments.length - 1];
    if (last.length === 2 && segments.length > 1) {
      text = text.replace(/,/g, ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasDot) {
    const segments = text.split(".");
    const last = segments[segments.length - 1];
    if (segments.length > 2 || last.length === 3) {
      text = text.replace(/\./g, "");
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMoney(amount: number | null, currency: string): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  const locale = CURRENCY_LOCALES[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function percentage(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}