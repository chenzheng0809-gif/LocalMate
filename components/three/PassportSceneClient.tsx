"use client";

import dynamic from "next/dynamic";

const PassportScene = dynamic(() => import("./PassportScene"), {
  ssr: false,
  loading: () => (
    <div className="passport-scene passport-scene-fallback" aria-label="正在加载产品护照可视化">
      <div className="passport-scene-fallback-mark">PP</div>
      <div className="passport-scene-label">
        <span>文件预览</span>
        <strong>产品护照</strong>
        <small>正在准备视觉层……</small>
      </div>
    </div>
  ),
});

export function PassportSceneClient() {
  return <PassportScene />;
}
