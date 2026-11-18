"use client";

import { useMemo } from "react";
import { geoGraticule10, geoInterpolate, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesTopology from "world-atlas/countries-110m.json";
import type { Country } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const COUNTRY_IDS: Record<Country, string> = { US: "840", JP: "392", DE: "276", UK: "826" };
const LABEL_POINT: Record<Country, [number, number]> = {
  US: [-99, 39],
  JP: [138.5, 36.5],
  DE: [10.4, 51.2],
  UK: [-2.6, 54.2],
};
const ORIGIN: [number, number] = [104.2, 35.2];
const CITY: Record<Country, string> = { US: "纽约", JP: "东京", DE: "柏林", UK: "伦敦" };
const ISO_TO_COUNTRY = Object.fromEntries(
  Object.entries(COUNTRY_IDS).map(([country, id]) => [id, country]),
) as Record<string, Country>;

interface MapData {
  shapes: { id: string; d: string; highlighted: boolean }[];
  graticule: string;
  markers: { country: Country; x: number; y: number; d: string }[];
  origin: { x: number; y: number } | null;
}

function buildMap(compact: boolean): MapData {
  const topology = countriesTopology as unknown as Topology<{ countries: GeometryCollection }>;
  const collection = feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry>;
  const width = 920;
  const height = compact ? 380 : 470;
  const projection = geoNaturalEarth1().fitSize([width, height], collection);
  const path = geoPath(projection);
  const shapes = collection.features.map((country) => {
    const id = String(country.id ?? "");
    return { id, d: path(country) ?? "", highlighted: Boolean(ISO_TO_COUNTRY[id]) };
  });
  const markers = (Object.keys(LABEL_POINT) as Country[]).map((country) => {
    const point = projection(LABEL_POINT[country]);
    const interpolate = geoInterpolate(ORIGIN, LABEL_POINT[country]);
    const arcPoints = Array.from({ length: 36 }, (_, index) => {
      const [lon, lat] = interpolate(index / 35);
      return projection([lon, lat]);
    }).filter((item): item is [number, number] => Boolean(item));
    return {
      country,
      x: point?.[0] ?? 0,
      y: point?.[1] ?? 0,
      d: arcPoints
        .map((item, index) => `${index === 0 ? "M" : "L"}${item[0].toFixed(1)},${item[1].toFixed(1)}`)
        .join(" "),
    };
  });
  const originPoint = projection(ORIGIN);
  return {
    shapes,
    graticule: path(geoGraticule10()) ?? "",
    markers,
    origin: originPoint ? { x: originPoint[0], y: originPoint[1] } : null,
  };
}

export function WorldMap({
  activeCountry,
  ranked,
  compact = false,
  className,
}: {
  activeCountry?: Country | null;
  ranked?: Country[];
  compact?: boolean;
  className?: string;
}) {
  const data = useMemo(() => buildMap(compact), [compact]);
  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 920 ${compact ? 380 : 470}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="世界地图，标出美国、日本、德国和英国市场节点"
      >
        <defs>
          <radialGradient id="map-glow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#2ee8f5" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#2ee8f5" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="arc-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f1c66d" stopOpacity="0.05" />
            <stop offset="55%" stopColor="#f1c66d" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2ee8f5" stopOpacity="0.7" />
          </linearGradient>
          <filter id="marker-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ellipse cx="460" cy="235" rx="440" ry="210" fill="url(#map-glow)" />
        <path d={data.graticule} fill="none" stroke="rgba(125,249,255,0.055)" strokeWidth="0.6" />
        {data.shapes.map((shape) => (
          <path
            key={shape.id}
            d={shape.d}
            fill={shape.highlighted ? "rgba(46,232,245,0.16)" : "rgba(13,40,56,0.65)"}
            stroke={shape.highlighted ? "rgba(125,249,255,0.38)" : "rgba(125,249,255,0.12)"}
            strokeWidth={shape.highlighted ? 0.9 : 0.5}
          />
        ))}
        {data.markers.map(({ country, x, y, d }) => {
          const isActive = activeCountry === country;
          const isRanked = ranked?.includes(country);
          return (
            <g key={country}>
              <path
                d={d}
                fill="none"
                stroke="url(#arc-gradient)"
                strokeWidth={isActive ? 1.4 : 0.8}
                strokeDasharray="3 5"
                opacity={isActive ? 0.95 : 0.55}
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="5s" repeatCount="indefinite" />
              </path>
              <circle cx={x} cy={y} r={isActive ? 16 : 11} fill={isActive ? "rgba(241,198,109,0.1)" : "rgba(46,232,245,0.06)"} className="animate-pulse-slow" />
              <circle cx={x} cy={y} r={isActive ? 4.5 : 3.2} fill={isActive ? "#f1c66d" : "#2ee8f5"} filter="url(#marker-glow)" />
              <line x1={x} y1={y - 8} x2={x} y2={y - 16} stroke={isActive ? "rgba(241,198,109,0.7)" : "rgba(125,249,255,0.4)"} strokeWidth="0.8" />
              <text
                x={x + (country === "US" ? 8 : 0)}
                y={y - 21}
                textAnchor={country === "US" ? "start" : "middle"}
                className="fill-soft font-mono"
                style={{ fontSize: 9, letterSpacing: "0.12em" }}
              >
                {CITY[country]}
              </text>
              {isRanked ? (
                <text x={x} y={y + 16} textAnchor="middle" className="fill-gold-300 font-mono" style={{ fontSize: 7, letterSpacing: "0.12em" }}>
                  验证
                </text>
              ) : null}
            </g>
          );
        })}
        {data.origin ? (
          <g>
            <circle cx={data.origin.x} cy={data.origin.y} r="3" fill="#f1c66d" opacity="0.8" />
            <text x={data.origin.x - 7} y={data.origin.y + 14} textAnchor="end" className="fill-gold-300/60 font-mono" style={{ fontSize: 7, letterSpacing: "0.12em" }}>
              中国 · 起运
            </text>
          </g>
        ) : null}
      </svg>
      <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-4 font-mono text-[8px] uppercase tracking-[0.16em] text-muted/60">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> 市场节点</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> 起运地 / 优先市场</span>
      </div>
    </div>
  );
}
