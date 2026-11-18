"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function PassportObject() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    const targetY = state.pointer.x * 0.35 + Math.sin(state.clock.elapsedTime * 0.35) * 0.08;
    const targetX = -state.pointer.y * 0.2 + Math.cos(state.clock.elapsedTime * 0.28) * 0.04;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetY, 2.5, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetX, 2.5, delta);
    if (ring.current) ring.current.rotation.z += delta * 0.12;
  });

  return (
    <group ref={group} rotation={[0.12, -0.28, 0]}>
      {/* Passport cover */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.75, 2.35, 0.14]} />
        <meshStandardMaterial color="#0b1b33" metalness={0.35} roughness={0.36} />
      </mesh>
      {/* Gold edge, deliberately thin */}
      <lineSegments position={[0, 0, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.77, 2.37, 0.16)]} />
        <lineBasicMaterial color="#d8b56b" transparent opacity={0.7} />
      </lineSegments>
      {/* Inset panel */}
      <mesh position={[0, 0.05, 0.081]}>
        <planeGeometry args={[1.45, 2.02]} />
        <meshStandardMaterial color="#102745" metalness={0.2} roughness={0.55} />
      </mesh>
      {/* Cyan intelligence ring */}
      <mesh ref={ring} position={[0, 0.05, 0.095]}>
        <torusGeometry args={[0.46, 0.012, 16, 96]} />
        <meshBasicMaterial color="#45e0ff" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.05, 0.1]}>
        <torusGeometry args={[0.27, 0.008, 16, 96]} />
        <meshBasicMaterial color="#d8b56b" transparent opacity={0.75} />
      </mesh>
      {/* Core mark */}
      <mesh position={[0, 0.05, 0.105]}>
        <icosahedronGeometry args={[0.115, 1]} />
        <meshStandardMaterial color="#d8b56b" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Route nodes */}
      {[
        [-0.6, 0.72, 0.1],
        [0.58, 0.4, 0.1],
        [0.45, -0.68, 0.1],
        [-0.5, -0.55, 0.1],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <sphereGeometry args={[0.028, 16, 16]} />
          <meshBasicMaterial color="#45e0ff" />
        </mesh>
      ))}
    </group>
  );
}

export default function PassportScene() {
  const [webglReady, setWebglReady] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      setWebglReady(Boolean(context));
    } catch {
      setWebglReady(false);
    }
  }, []);

  if (!webglReady) {
    return (
      <div className="passport-scene passport-scene-fallback" aria-label="产品护照可视化替代显示">
        <div className="passport-scene-fallback-mark">PP</div>
        <div className="passport-scene-label">
          <span>文件预览</span>
          <strong>产品护照</strong>
          <small>{webglReady === false ? "当前浏览器未提供 WebGL；证据与判断不受影响。" : "正在准备视觉层……"}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="passport-scene" aria-label="数字化产品护照可视化">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 4.6], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} color="#cfe9ff" />
        <pointLight position={[-3, -2, 2]} intensity={1.8} color="#d8b56b" />
        <PassportObject />
      </Canvas>
      <div className="passport-scene-label">
        <span>文件预览</span>
        <strong>产品护照</strong>
        <small>R3F / Hi3D 占位 · 受证据启发，不是认证</small>
      </div>
    </div>
  );
}
