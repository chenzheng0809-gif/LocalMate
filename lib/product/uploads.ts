import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { uid } from "@/lib/db/client";
import { sanitizeSourceUrl } from "@/lib/search/source-validator";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function saveDataUrlImage(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/s);
  if (!match) {
    throw new AppError("只能上传 PNG、JPEG、WebP 或 GIF 图片。", { status: 422 });
  }
  const mime = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > config.maxUploadBytes) {
    throw new AppError(
      `图片过大。最大尺寸为 ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB。`,
      { status: 413 },
    );
  }
  const extension = ALLOWED_TYPES[mime];
  if (!extension) throw new AppError("不支持的图片类型。", { status: 422 });
  mkdirSync(config.uploadDir, { recursive: true });
  const name = `${uid("img")}.${extension}`;
  writeFileSync(path.join(config.uploadDir, name), buffer);
  return `/api/files/${name}`;
}

export function saveImages(images: string[]): { aiImages: string[]; storedImages: string[] } {
  const aiImages: string[] = [];
  const storedImages: string[] = [];
  for (const image of images.slice(0, 6)) {
    if (image.startsWith("data:image/")) {
      const saved = saveDataUrlImage(image);
      aiImages.push(image);
      storedImages.push(saved);
    } else if (image.startsWith("https://") || image.startsWith("http://")) {
      const sanitized = sanitizeSourceUrl(image);
      if (!sanitized || !sanitized.startsWith("https://")) {
        throw new AppError("远程图片必须使用公开 HTTPS 链接。", { status: 422 });
      }
      aiImages.push(sanitized);
      storedImages.push(sanitized);
    } else {
      throw new AppError("每张图片必须是 data URL 或公开图片链接。", { status: 422 });
    }
  }
  return { aiImages, storedImages };
}
