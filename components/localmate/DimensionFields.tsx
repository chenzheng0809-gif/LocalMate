"use client";

import { useState } from "react";
import { parseDimensions, dimensionUnits, type DimensionUnit } from "@/lib/localmate/report-model";

const inCm = { mm: 0.1, cm: 1, m: 100 };
const axes = ["长", "宽", "高"];

export function DimensionFields({ name, label, value, required }: {
  name: string; label: string; value?: string | null; required?: boolean;
}) {
  const initial = parseDimensions(value);
  const [unit, setUnit] = useState<DimensionUnit>(initial?.unit ?? "cm");
  const [sides, setSides] = useState(() => axes.map((_, index) => String(initial?.sides[index] ?? "")));
  return <fieldset className="lm-dimensions">
    <legend>{label}</legend>
    <div className="lm-dimension-grid">
      {axes.map((axis, index) => <label key={axis}>{axis}
        <input name={`${name}${index}`} type="number" inputMode="decimal" min="0.000001" max="1000000"
          step="any" required={required} value={sides[index]}
          onChange={event => setSides(sides.map((side, i) => i === index ? event.target.value : side))}/>
      </label>)}
      <label>单位<select name={`${name}Unit`} value={unit} onChange={event => {
        const next = event.target.value as DimensionUnit;
        setSides(sides.map(side => side ? String(Number((Number(side) * inCm[unit] / inCm[next]).toFixed(9))) : ""));
        setUnit(next);
      }}>{dimensionUnits.map(option => <option key={option}>{option}</option>)}</select></label>
    </div>
    {value && !initial && <small>原记录 {value}，请核对后填写。</small>}
  </fieldset>;
}

export function readDimensions(data: FormData, name: string) {
  const sides = axes.map((_, index) => String(data.get(`${name}${index}`) ?? ""));
  if (sides.every(side => !side)) return null;
  const value = `${sides.map(side => side && Number(side).toFixed(9).replace(/0+$/, "").replace(/\.$/, "")).join(" × ")} ${data.get(`${name}Unit`)}`;
  const parsed = parseDimensions(value);
  if (parsed?.sides.length !== 3) throw new Error("请填写有效的长、宽、高。");
  return value;
}
