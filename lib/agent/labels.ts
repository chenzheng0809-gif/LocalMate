export const MISSING_FIELD_LABELS: Record<string, string> = {
  name: "产品名称",
  category: "品类",
  description: "产品描述",
  "attributes.material": "材质",
  "attributes.dimensions": "产品尺寸",
  "attributes.packagingDimensions": "包装尺寸",
  "attributes.weight": "带包装重量",
  "attributes.color": "颜色",
  "attributes.intendedUse": "使用场景",
  "attributes.electrical": "是否含电子元件",
  "sourcing.priceCNY": "采购价",
  "sourcing.MOQ": "MOQ",
  "sourcing.supplier": "供应商",
  dimensions: "产品尺寸",
  weight: "带包装重量",
  electrical: "是否含电子元件",
  color: "颜色",
  material: "材质",
  priceCNY: "采购价",
  MOQ: "MOQ",
  supplier: "供应商",
  intendedUse: "使用场景",
};

export function missingFieldLabel(field: string): string {
  return MISSING_FIELD_LABELS[field] ?? field.replace("attributes.", "");
}
