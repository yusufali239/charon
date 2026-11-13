import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";

export const toWorld = (gx, gy) => [gx - 7.5, 0, gy - 6.0];

export const TABLE_POS = (() => {
  const [x, , z] = toWorld(8, 5);
  return new THREE.Vector3(x, 0.04, z);
})();

export const DESKS = [
  { id: "lead", label: "АТЛАС // LEAD", gx: 1, gy: 2.5, facing: 1, accent: "#38bdf8", screenKind: "arch" },
  { id: "cybersec", label: "ВЕКТОР // SEC", gx: 1, gy: 6.5, facing: 1, accent: "#f43f5e", screenKind: "radar" },
  { id: "dev", label: "НОВА // DEV", gx: 1, gy: 10.5, facing: 1, accent: "#22c55e", screenKind: "code" },
  { id: "growth", label: "ПУЛЬС // GROWTH", gx: 14, gy: 2.5, facing: -1, accent: "#f59e0b", screenKind: "chart" },
  { id: "motion", label: "ШЕЙДЕР // MOTION", gx: 14, gy: 8.5, facing: -1, accent: "#a855f7", screenKind: "wave" },
];

export const CAMERA_PRESETS = {
  overview: {
    position: new THREE.Vector3(0, 11.2, 13.4),
    target: new THREE.Vector3(0, 0.3, -0.4),
  },
  meeting: {
    position: new THREE.Vector3(0.5, 4.6, 3.8),
    target: new THREE.Vector3(0.5, 0.85, -1.0),
  },
  lounge: {
    position: new THREE.Vector3(-0.9, 3.5, -0.4),
    target: new THREE.Vector3(-1.3, 0.85, -5.0),
  },
};

/* ---------- Shared low-cost geometries (created once) ---------- */
const GEO = {
  plane: new THREE.PlaneGeometry(1, 1),
  disc: new THREE.CircleGeometry(1, 28),
  ring: new THREE.RingGeometry(0.82, 1, 32),
  beam: new THREE.CylinderGeometry(0.03, 0.24, 1, 10, 1, true),
};

export const additive = (color, opacity) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

/* ---------- Procedural CanvasTexture generator for workstation screens ---------- */
function createMonitorTexture(kind, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");

  // Dark IDE / Telemetry backdrop
  ctx.fillStyle = "#08101e";
  ctx.fillRect(0, 0, 256, 144);

  // Top header bar
  ctx.fillStyle = "#111e33";
  ctx.fillRect(0, 0, 256, 16);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 15, 256, 1.5);
  ["#f43f5e", "#f59e0b", "#22c55e"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(10 + i * 9, 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (kind === "code") {
    // Code editor lines + sidebar
    ctx.fillStyle = "#0d1729";
    ctx.fillRect(0, 17, 42, 127);
    const colors = ["#38bdf8", "#22c55e", "#a855f7", "#e2e8f0", "#f59e0b"];
    for (let row = 0; row < 12; row++) {
      const y = 26 + row * 9.5;
      const indent = (row % 4) * 10 + 50;
      const w1 = 28 + ((row * 37) % 55);
      const w2 = 18 + ((row * 23) % 45);
      ctx.fillStyle = "#334155";
      ctx.fillRect(8, y, 22, 4);
      ctx.fillStyle = colors[row % colors.length];
      ctx.fillRect(indent, y, w1, 4.5);
      ctx.fillStyle = "rgba(226,232,240,0.45)";
      ctx.fillRect(indent + w1 + 6, y, w2, 4.5);
    }
  } else if (kind === "radar") {
    // CyberSec threat radar + log stream
    ctx.strokeStyle = "rgba(244,63,94,0.35)";
    ctx.lineWidth = 1.2;
    [18, 34, 50].forEach((r) => {
      ctx.beginPath();
      ctx.arc(68, 82, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(16, 82);
    ctx.lineTo(120, 82);
    ctx.moveTo(68, 30);
    ctx.lineTo(68, 134);
    ctx.stroke();
    ctx.fillStyle = "rgba(244,63,94,0.28)";
    ctx.beginPath();
    ctx.moveTo(68, 82);
    ctx.arc(68, 82, 50, -0.6, 0.15);
    ctx.closePath();
    ctx.fill();
    // Threat blips
    ctx.fillStyle = "#fb7185";
    [
      [86, 62],
      [48, 96],
      [96, 98],
    ].forEach(([bx, by]) => {
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    // Right log bars
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 3 === 0 ? "#f43f5e" : "#38bdf8";
      ctx.fillRect(136, 28 + i * 13, 40 + ((i * 29) % 65), 6);
    }
  } else if (kind === "chart") {
    // Growth analytics bars + trendline
    ctx.strokeStyle = "rgba(245,158,11,0.2)";
    for (let g = 0; g < 4; g++) {
      ctx.beginPath();
      ctx.moveTo(16, 36 + g * 24);
      ctx.lineTo(240, 36 + g * 24);
      ctx.stroke();
    }
    const heights = [36, 52, 44, 68, 82, 74, 96, 88];
    heights.forEach((h, i) => {
      ctx.fillStyle = i % 2 === 0 ? "#f59e0b" : "#38bdf8";
      ctx.fillRect(22 + i * 27, 126 - h, 16, h);
    });
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    heights.forEach((h, i) => {
      const px = 30 + i * 27;
      const py = 118 - h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  } else if (kind === "wave") {
    // Motion Graphics bezier waveforms + timeline
    const waves = [
      { c: "#a855f7", amp: 24, freq: 0.055, ph: 0 },
      { c: "#38bdf8", amp: 18, freq: 0.075, ph: 1.4 },
      { c: "#f472b6", amp: 14, freq: 0.09, ph: 2.8 },
    ];
    waves.forEach((w) => {
      ctx.strokeStyle = w.c;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let x = 14; x <= 242; x += 4) {
        const y = 72 + Math.sin(x * w.freq + w.ph) * w.amp;
        if (x === 14) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    // Keyframe timeline strip
    ctx.fillStyle = "#162036";
    ctx.fillRect(14, 114, 228, 18);
    [40, 88, 140, 195].forEach((kx) => {
      ctx.fillStyle = "#e879f9";
      ctx.fillRect(kx, 118, 6, 10);
    });
  } else {
    // Architecture topology (Atlas)
    const nodes = [
      [128, 44, "#38bdf8"],
      [56, 98, "#f43f5e"],
      [104, 108, "#22c55e"],
      [154, 108, "#f59e0b"],
      [204, 98, "#a855f7"],
    ];
    ctx.strokeStyle = "rgba(56,189,248,0.45)";
    ctx.lineWidth = 1.6;
    nodes.slice(1).forEach(([nx, ny]) => {
      ctx.beginPath();
      ctx.moveTo(128, 44);
      ctx.lineTo(nx, ny);
      ctx.stroke();
    });
    nodes.forEach(([nx, ny, c]) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(nx, ny, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- Neon sign texture ---------- */
function createNeonSignTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 768, 144);

  ctx.fillStyle = "rgba(12, 20, 38, 0.85)";
  ctx.fillRect(8, 12, 752, 120);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 16, 744, 112);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "bold 54px Inter, Segoe UI, sans-serif";
  ctx.fillText("CHARON // AI STUDIO", 384, 62);

  ctx.shadowColor = "#a855f7";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#c084fc";
  ctx.font = "600 20px monospace";
  ctx.fillText("AUTONOMOUS MULTI-AGENT WORKSPACE  •  LIVE TELEMETRY", 384, 104);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- Floating hologram above active desk ---------- */
function Hologram({ color, facing, seed = 0 }) {
  const groupRef = useRef();
  const barRefs = useRef([]);
  const mats = useMemo(
    () => ({
      panel: additive(color, 0.16),
      frame: additive(color, 0.82),
      bar: additive(color, 0.62),
      beam: additive(color, 0.14),
    }),
    [color]
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (groupRef.current) groupRef.current.position.y = 2.02 + Math.sin(t * 1.8) * 0.05;
    barRefs.current.forEach((b, i) => {
      if (!b) return;
      const s = 0.22 + Math.abs(Math.sin(t * 2.8 + i * 1.15)) * 0.78;
      b.scale.y = 0.42 * s;
      b.position.y = -0.23 + (0.42 * s) / 2;
    });
    mats.panel.opacity = 0.13 + Math.sin(t * 5) * 0.025;
  });

  return (
    <>
      <mesh geometry={GEO.beam} material={mats.beam} position={[-0.18 * facing, 1.62, 0]} scale={[1, 0.55, 1]} rotation={[Math.PI, 0, 0]} />
      <group ref={groupRef} position={[-0.18 * facing, 2.02, 0]} rotation={[0, 0.72 * facing, 0]}>
        <mesh geometry={GEO.plane} material={mats.panel} scale={[1.1, 0.6, 1]} />
        <mesh geometry={GEO.plane} material={mats.frame} position={[0, 0.3, 0]} scale={[1.1, 0.018, 1]} />
        <mesh geometry={GEO.plane} material={mats.frame} position={[0, -0.3, 0]} scale={[1.1, 0.018, 1]} />
        <mesh geometry={GEO.plane} material={mats.frame} position={[-0.55, 0, 0]} scale={[0.018, 0.6, 1]} />
        <mesh geometry={GEO.plane} material={mats.frame} position={[0.55, 0, 0]} scale={[0.018, 0.6, 1]} />
        <mesh geometry={GEO.plane} material={mats.bar} position={[-0.18, 0.2, 0]} scale={[0.6, 0.035, 1]} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh
            key={i}
            ref={(el) => (barRefs.current[i] = el)}
            geometry={GEO.plane}
            material={mats.bar}
            position={[-0.38 + i * 0.15, -0.1, 0]}
            scale={[0.08, 0.3, 1]}
          />
        ))}
      </group>
    </>
  );
}

/* ---------- Detailed Ergonomic Workstation ---------- */
function Workstation({ gx, gy, facing = 1, accent = "#38bdf8", screenKind = "code", active = false }) {
  const [wx, , wz] = toWorld(gx, gy);
  const screenTex = useMemo(() => createMonitorTexture(screenKind, accent), [screenKind, accent]);
  useEffect(() => () => screenTex.dispose(), [screenTex]);

  const front = -facing; // monitors face toward the chair (+facing side)
  const chairX = 0.72 * facing;

  return (
    <group position={[wx, 0, wz]}>
      {/* Subtle floor zone mat */}
      <mesh position={[0.2 * facing, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.95, 2.2]} />
        <meshStandardMaterial color="#182234" roughness={0.85} />
      </mesh>
      <mesh position={[0.2 * facing, 0.008, -1.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.95, 0.025]} />
        <meshBasicMaterial color={accent} transparent opacity={active ? 0.85 : 0.3} />
      </mesh>
      <mesh position={[0.2 * facing, 0.008, 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.95, 0.025]} />
        <meshBasicMaterial color={accent} transparent opacity={active ? 0.85 : 0.3} />
      </mesh>

      {/* Tabletop */}
      <mesh position={[0, 0.73, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.06, 1.84]} />
        <meshStandardMaterial color="#273449" roughness={0.42} metalness={0.22} />
      </mesh>
      {/* Accent LED trim */}
      <mesh position={[0.47 * front, 0.73, 0]}>
        <boxGeometry args={[0.022, 0.025, 1.84]} />
        <meshBasicMaterial color={accent} transparent opacity={active ? 1 : 0.45} />
      </mesh>

      {/* Architectural C-legs & cross-beam */}
      {[-0.78, 0.78].map((lz) => (
        <group key={lz} position={[0, 0, lz]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <boxGeometry args={[0.08, 0.7, 0.07]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.03, 0]} castShadow>
            <boxGeometry args={[0.74, 0.05, 0.09]} />
            <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.2 * facing, 0.56, 0]}>
        <boxGeometry args={[0.04, 0.06, 1.5]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} />
      </mesh>

      {/* Dual monitor stand */}
      <mesh position={[0.25 * front, 0.91, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.032, 0.32, 10]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.25 * front, 0.77, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.24]} />
        <meshStandardMaterial color="#334155" metalness={0.5} />
      </mesh>

      {/* Main Curved / Ultrawide Monitor */}
      <group position={[0.18 * front, 1.07, -0.14]} rotation={[0, facing > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.88, 0.48, 0.04]} />
          <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[0.83, 0.43]} />
          <meshStandardMaterial
            map={screenTex}
            emissiveMap={screenTex}
            emissive="#ffffff"
            emissiveIntensity={active ? 1.15 : 0.7}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* Angled Secondary Vertical/Side Monitor */}
      <group position={[0.1 * front, 1.06, 0.46]} rotation={[0, (facing > 0 ? Math.PI / 2 : -Math.PI / 2) + 0.34 * facing, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.5, 0.036]} />
          <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[0.38, 0.45]} />
          <meshStandardMaterial
            map={screenTex}
            emissiveMap={screenTex}
            emissive="#ffffff"
            emissiveIntensity={active ? 1.0 : 0.55}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* Deskmat, Mechanical Keyboard & Mouse */}
      <mesh position={[-0.08 * front, 0.764, -0.05]}>
        <boxGeometry args={[0.36, 0.006, 0.78]} />
        <meshStandardMaterial color="#162032" roughness={0.9} />
      </mesh>
      <mesh position={[-0.08 * front, 0.774, -0.1]} castShadow>
        <boxGeometry args={[0.14, 0.018, 0.38]} />
        <meshStandardMaterial color="#334155" roughness={0.4} />
      </mesh>
      <mesh position={[-0.08 * front, 0.769, -0.1]}>
        <boxGeometry args={[0.15, 0.008, 0.39]} />
        <meshBasicMaterial color={accent} transparent opacity={active ? 0.9 : 0.45} />
      </mesh>
      <mesh position={[-0.08 * front, 0.774, 0.2]} castShadow>
        <boxGeometry args={[0.09, 0.02, 0.055]} />
        <meshStandardMaterial color="#475569" roughness={0.35} />
      </mesh>

      {/* RGB Glass-Panel PC Tower */}
      <group position={[0.12 * front, 0.95, -0.72]}>
        <mesh castShadow>
          <boxGeometry args={[0.38, 0.38, 0.2]} />
          <meshStandardMaterial color="#111827" metalness={0.55} roughness={0.35} />
        </mesh>
        {/* Front RGB strip */}
        <mesh position={[-0.195 * front, 0, 0]}>
          <boxGeometry args={[0.012, 0.32, 0.14]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        {/* Glass side window glow */}
        <mesh position={[0, 0, 0.102]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial color={accent} transparent opacity={active ? 0.32 : 0.15} />
        </mesh>
      </group>

      {/* Ergonomic Office Chair */}
      <group position={[chairX, 0, 0]} rotation={[0, facing > 0 ? 0 : Math.PI, 0]}>
        {/* 5-star base & cylinder */}
        <mesh position={[0, 0.04, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.28, 0.05, 5]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.035, 0.04, 0.34, 10]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
        {/* Seat cushion */}
        <mesh position={[0, 0.41, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.08, 0.46]} />
          <meshStandardMaterial color="#334155" roughness={0.65} />
        </mesh>
        {/* Sculpted Backrest + Accent Trim */}
        <mesh position={[0.21, 0.72, 0]} rotation={[0, 0, -0.1]} castShadow>
          <boxGeometry args={[0.07, 0.56, 0.4]} />
          <meshStandardMaterial color="#273449" roughness={0.6} />
        </mesh>
        <mesh position={[0.17, 0.72, 0]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.015, 0.44, 0.08]} />
          <meshBasicMaterial color={accent} transparent opacity={0.6} />
        </mesh>
        {/* Armrests */}
        {[-0.24, 0.24].map((az) => (
          <mesh key={az} position={[0.02, 0.56, az]} castShadow>
            <boxGeometry args={[0.26, 0.04, 0.05]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
        ))}
      </group>

      {active && <Hologram color={accent} facing={facing} seed={gy} />}
    </group>
  );
}

/* ---------- Central Conference Pod with Glass Table, Chairs & Rotating 3D Core ---------- */
function ConferencePod({ active }) {
  const coreOuterRef = useRef();
  const coreInnerRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const auraMat = useMemo(() => additive("#38bdf8", 0.06), []);
  const beamMat = useMemo(() => additive("#38bdf8", 0.14), []);
  const [wx, , wz] = toWorld(8, 5);

  useEffect(() => () => {
    auraMat.dispose();
    beamMat.dispose();
  }, [auraMat, beamMat]);

  useFrame(({ clock }, delta) => {
    const spd = active ? 2.2 : 0.65;
    const t = clock.elapsedTime;
    if (coreOuterRef.current) {
      coreOuterRef.current.rotation.y += delta * spd;
      coreOuterRef.current.rotation.x = Math.sin(t * 0.9) * 0.35;
      coreOuterRef.current.position.y = 1.32 + Math.sin(t * 2.1) * 0.05;
    }
    if (coreInnerRef.current) {
      coreInnerRef.current.rotation.y -= delta * spd * 1.4;
      coreInnerRef.current.rotation.z += delta * spd * 0.8;
      coreInnerRef.current.position.y = 1.32 + Math.sin(t * 2.1) * 0.05;
    }
    if (ring1Ref.current) ring1Ref.current.rotation.z += delta * spd * 0.9;
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x += delta * spd * 0.7;
      ring2Ref.current.rotation.y += delta * spd * 0.5;
    }
    auraMat.opacity = active ? 0.18 + Math.sin(t * 3) * 0.06 : 0.06;
    beamMat.opacity = active ? 0.22 + Math.sin(t * 4) * 0.05 : 0.08;
  });

  // 5 conference chairs positioned cleanly around the table
  const chairAngles = [Math.PI, -Math.PI * 0.52, -Math.PI * 0.18, Math.PI * 0.22, Math.PI * 0.58];

  return (
    <group position={[wx, 0, wz]}>
      {/* Architectural pod floor ring & glow disc */}
      <mesh geometry={GEO.disc} material={auraMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} scale={2.4} />
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[2.15, 2.26, 48]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={active ? 0.85 : 0.35} />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.15, 48]} />
        <meshStandardMaterial color="#182338" roughness={0.45} metalness={0.25} />
      </mesh>

      {/* Pedestal Base */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.5, 0.7, 20]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.73, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.05, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>

      {/* Glass Conference Tabletop */}
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.38, 1.38, 0.05, 36]} />
        <meshPhysicalMaterial
          color="#bae6fd"
          transparent
          opacity={0.42}
          roughness={0.08}
          metalness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.05}
          reflectivity={0.95}
        />
      </mesh>
      {/* Brushed titanium table rim */}
      <mesh position={[0, 0.76, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.38, 0.025, 10, 48]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Projector emitter ring & projection cone */}
      <mesh ref={ring1Ref} position={[0, 0.795, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.42, 32]} />
        <meshBasicMaterial color={active ? "#38bdf8" : "#64748b"} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={GEO.beam} material={beamMat} position={[0, 1.06, 0]} scale={[1.8, 0.55, 1.8]} rotation={[Math.PI, 0, 0]} />

      {/* Rotating 3D Holographic Core */}
      <mesh ref={coreOuterRef} position={[0, 1.32, 0]}>
        <icosahedronGeometry args={[0.28, 0]} />
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={active ? 0.9 : 0.55} />
      </mesh>
      <mesh ref={coreInnerRef} position={[0, 1.32, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#c084fc"
          emissiveIntensity={active ? 1.8 : 0.85}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
      <mesh ref={ring2Ref} position={[0, 1.32, 0]}>
        <torusGeometry args={[0.42, 0.012, 8, 36]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={active ? 0.85 : 0.45} />
      </mesh>

      {/* Overhead Halo Pendant Light */}
      <mesh position={[0, 3.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.45, 0.035, 10, 48]} />
        <meshStandardMaterial color="#1e293b" emissive="#38bdf8" emissiveIntensity={active ? 1.5 : 0.9} />
      </mesh>

      {/* Conference Chairs */}
      {chairAngles.map((ang, i) => {
        const r = 1.66;
        const cx = Math.cos(ang) * r;
        const cz = Math.sin(ang) * r;
        return (
          <group key={i} position={[cx, 0, cz]} rotation={[0, -ang + Math.PI / 2, 0]}>
            <mesh position={[0, 0.22, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.2, 0.4, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.6} />
            </mesh>
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[0.4, 0.06, 0.4]} />
              <meshStandardMaterial color="#273449" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.68, -0.18]} castShadow>
              <boxGeometry args={[0.38, 0.44, 0.06]} />
              <meshStandardMaterial color="#334155" roughness={0.55} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ---------- Plush Lounge Sofa + Coffee Bar + Stools ---------- */
function LoungeAndCoffeeZone() {
  const [barX, , barZ] = toWorld(8, 1); // (0.5, -5.0)
  return (
    <group>
      {/* Warm wood-slate lounge floor pad */}
      <mesh position={[-1.4, 0.006, -4.9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6.8, 2.3]} />
        <meshStandardMaterial color="#231f24" roughness={0.8} />
      </mesh>

      {/* Coffee Bar Counter */}
      <group position={[barX, 0, barZ]}>
        {/* Counter body */}
        <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.7, 0.96, 0.76]} />
          <meshStandardMaterial color="#3b2f2f" roughness={0.55} />
        </mesh>
        {/* Marble waterfall countertop */}
        <mesh position={[0, 0.99, 0.03]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 0.07, 0.86]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.1} />
        </mesh>
        {/* Warm under-counter LED strip */}
        <mesh position={[0, 0.92, 0.4]}>
          <boxGeometry args={[2.65, 0.025, 0.02]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>

        {/* Brushed Steel Espresso Machine */}
        <group position={[-0.65, 1.24, -0.08]}>
          <mesh castShadow>
            <boxGeometry args={[0.52, 0.44, 0.4]} />
            <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.08, 0.21]}>
            <boxGeometry args={[0.38, 0.08, 0.02]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
          {/* Cups */}
          {[-0.1, 0.1].map((cx) => (
            <mesh key={cx} position={[cx, -0.15, 0.22]} castShadow>
              <cylinderGeometry args={[0.035, 0.028, 0.07, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.2} />
            </mesh>
          ))}
        </group>

        {/* Pastry / Snack Display Case */}
        <mesh position={[0.45, 1.16, -0.05]} castShadow>
          <boxGeometry args={[0.56, 0.26, 0.34]} />
          <meshPhysicalMaterial color="#e0f2fe" transparent opacity={0.35} roughness={0.1} clearcoat={1} />
        </mesh>
        <mesh position={[0.45, 1.07, -0.05]}>
          <boxGeometry args={[0.46, 0.05, 0.24]} />
          <meshStandardMaterial color="#d97706" roughness={0.6} />
        </mesh>

        {/* 3 Modern Bar Stools */}
        {[-0.85, 0, 0.85].map((sx) => (
          <group key={sx} position={[sx, 0, 0.64]}>
            <mesh position={[0, 0.02, 0]} castShadow>
              <cylinderGeometry args={[0.18, 0.2, 0.03, 14]} />
              <meshStandardMaterial color="#334155" metalness={0.7} />
            </mesh>
            <mesh position={[0, 0.35, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.64, 10]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.14, 0.014, 8, 20]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.68, 0]} castShadow>
              <cylinderGeometry args={[0.19, 0.17, 0.08, 16]} />
              <meshStandardMaterial color="#b45309" roughness={0.55} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Plush Lounge Sofa + Rug + Coffee Table (clear of (2,2), (3,2), (6,2)) */}
      <group position={[-3.25, 0, -5.25]}>
        {/* Woven rug */}
        <mesh position={[0, 0.012, 0.55]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[2.3, 1.55]} />
          <meshStandardMaterial color="#273244" roughness={0.95} />
        </mesh>
        {/* Sofa frame & legs */}
        <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.22, 0.82]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>
        {/* Seat cushions */}
        {[-0.58, 0, 0.58].map((cx) => (
          <mesh key={cx} position={[cx, 0.38, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[0.56, 0.14, 0.68]} />
            <meshStandardMaterial color="#475569" roughness={0.85} />
          </mesh>
        ))}
        {/* Backrest + Armrests */}
        <mesh position={[0, 0.58, -0.32]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.48, 0.18]} />
          <meshStandardMaterial color="#3f4e63" roughness={0.8} />
        </mesh>
        {[-0.94, 0.94].map((ax) => (
          <mesh key={ax} position={[ax, 0.44, 0]} castShadow>
            <boxGeometry args={[0.14, 0.34, 0.82]} />
            <meshStandardMaterial color="#3f4e63" roughness={0.8} />
          </mesh>
        ))}
        {/* Accent throw pillows */}
        <mesh position={[-0.68, 0.53, -0.14]} rotation={[0.25, 0.3, 0]} castShadow>
          <boxGeometry args={[0.26, 0.24, 0.1]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.8} />
        </mesh>
        <mesh position={[0.66, 0.53, -0.14]} rotation={[0.25, -0.25, 0]} castShadow>
          <boxGeometry args={[0.26, 0.24, 0.1]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.8} />
        </mesh>

        {/* Smoked-glass low coffee table */}
        <group position={[0, 0, 0.82]}>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.22, 0.34, 14]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.45, 0.45, 0.03, 24]} />
            <meshPhysicalMaterial color="#94a3b8" transparent opacity={0.5} roughness={0.1} clearcoat={1} />
          </mesh>
          {/* Glowing tablet on table */}
          <mesh position={[-0.1, 0.385, 0.05]} rotation={[-Math.PI / 2, 0, 0.3]}>
            <planeGeometry args={[0.22, 0.15]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ---------- Glass-Enclosed Server Room with Blinking LED Racks ---------- */
function ServerRoom() {
  const [wx, , wz] = toWorld(7.5, 11); // (0.0, 5.0)
  const ledRefs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ledRefs.current.forEach((m, i) => {
      if (!m) return;
      const blink = Math.sin(t * (3.5 + (i % 5) * 1.4) + i * 1.9);
      m.material.opacity = blink > -0.2 ? 0.95 : 0.18;
    });
  });

  const ledColors = ["#22c55e", "#38bdf8", "#a855f7", "#22d3ee", "#f59e0b"];
  let ledIdx = 0;

  return (
    <group position={[wx, 0, wz]}>
      {/* Raised anti-static server room floor */}
      <mesh position={[0, 0.025, 0]} receiveShadow>
        <boxGeometry args={[2.9, 0.05, 1.55]} />
        <meshStandardMaterial color="#162235" roughness={0.45} metalness={0.35} />
      </mesh>
      {/* Perimeter status floor trim */}
      <mesh position={[0, 0.052, -0.77]}>
        <boxGeometry args={[2.9, 0.01, 0.03]} />
        <meshBasicMaterial color="#22d3ee" />
      </mesh>

      {/* Dual Server Racks */}
      {[-0.72, 0.72].map((rx, rackI) => (
        <group key={rx} position={[rx, 0, 0]}>
          <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.05, 2.0, 0.72]} />
            <meshStandardMaterial color="#111827" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Rack front bezel */}
          <mesh position={[0, 1.05, -0.37]}>
            <boxGeometry args={[0.92, 1.84, 0.02]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} />
          </mesh>
          {/* Blinking LED strips on both front and back faces */}
          {[0.38, 0.62, 0.86, 1.1, 1.34, 1.58, 1.8].map((ly, rowI) => {
            const c = ledColors[(rackI * 3 + rowI) % ledColors.length];
            const idx = ledIdx++;
            return (
              <mesh
                key={ly}
                ref={(el) => (ledRefs.current[idx] = el)}
                position={[0, ly, -0.385]}
              >
                <boxGeometry args={[0.78, 0.045, 0.015]} />
                <meshBasicMaterial color={c} transparent opacity={0.9} />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Glass Enclosure Frame & Panels */}
      {[
        [-1.44, -0.76],
        [1.44, -0.76],
        [-1.44, 0.76],
        [1.44, 0.76],
        [-0.36, -0.76],
        [0.36, -0.76],
      ].map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.18, pz]} castShadow>
          <boxGeometry args={[0.06, 2.32, 0.06]} />
          <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
      {/* Top header frame */}
      <mesh position={[0, 2.34, -0.76]}>
        <boxGeometry args={[2.94, 0.08, 0.08]} />
        <meshStandardMaterial color="#334155" metalness={0.7} />
      </mesh>
      <mesh position={[0, 2.34, 0.76]}>
        <boxGeometry args={[2.94, 0.08, 0.08]} />
        <meshStandardMaterial color="#334155" metalness={0.7} />
      </mesh>
      {/* Glass front & side walls */}
      <mesh position={[0, 1.18, -0.76]}>
        <planeGeometry args={[2.82, 2.24]} />
        <meshPhysicalMaterial color="#a5f3fc" transparent opacity={0.22} roughness={0.08} clearcoat={1} reflectivity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-1.44, 1.18, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.48, 2.24]} />
        <meshPhysicalMaterial color="#a5f3fc" transparent opacity={0.22} roughness={0.08} clearcoat={1} reflectivity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[1.44, 1.18, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.48, 2.24]} />
        <meshPhysicalMaterial color="#a5f3fc" transparent opacity={0.22} roughness={0.08} clearcoat={1} reflectivity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---------- Architectural Glass Partition Walls ---------- */
function GlassPartitions() {
  const panels = [
    // Between left workstations (safe from walkable aisles)
    { pos: [-6.5, 1.1, -1.5], size: [2.2, 2.1, 0.03], rotY: 0, accent: "#38bdf8" },
    { pos: [-6.5, 1.1, 2.5], size: [2.2, 2.1, 0.03], rotY: 0, accent: "#22c55e" },
    // Between right workstations
    { pos: [6.5, 1.1, -0.5], size: [2.2, 2.1, 0.03], rotY: 0, accent: "#a855f7" },
    // Low acoustic glass wings near lounge / conference transition
    { pos: [-4.5, 0.8, -5.2], size: [0.03, 1.5, 1.4], rotY: 0, accent: "#fbbf24" },
  ];

  return (
    <group>
      {panels.map((p, i) => (
        <group key={i} position={p.pos} rotation={[0, p.rotY, 0]}>
          <mesh>
            <boxGeometry args={p.size} />
            <meshPhysicalMaterial
              color="#bae6fd"
              transparent
              opacity={0.2}
              roughness={0.08}
              metalness={0.1}
              clearcoat={1}
              reflectivity={0.95}
              depthWrite={false}
            />
          </mesh>
          {/* Top & bottom aluminum rails */}
          <mesh position={[0, p.size[1] / 2, 0]}>
            <boxGeometry args={[p.size[0] + 0.04, 0.045, p.size[2] + 0.04]} />
            <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, -p.size[1] / 2 + 0.02, 0]}>
            <boxGeometry args={[p.size[0] + 0.04, 0.045, p.size[2] + 0.04]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
          </mesh>
          {/* Frosted neon privacy stripe */}
          <mesh position={[0, -0.1, 0]}>
            <boxGeometry args={[p.size[0] + 0.004, 0.04, p.size[2] + 0.004]} />
            <meshBasicMaterial color={p.accent} transparent opacity={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------- Potted Studio Plants ---------- */
function PottedPlant({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.18, 0.48, 14]} />
        <meshStandardMaterial color="#334155" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.04, 14]} />
        <meshStandardMaterial color="#3f2e21" roughness={0.95} />
      </mesh>
      {/* Layered foliage fronds */}
      {[
        [0, 0.72, 0, 0.15, 0.2, "#15803d"],
        [0.14, 0.66, 0.08, 0.5, 0.8, "#16a34a"],
        [-0.14, 0.68, -0.06, -0.45, -0.9, "#22c55e"],
        [0.05, 0.78, -0.14, -0.35, 0.4, "#16a34a"],
        [-0.08, 0.62, 0.15, 0.4, -0.5, "#22c55e"],
      ].map(([px, py, pz, rx, rz, col], idx) => (
        <mesh key={idx} position={[px, py, pz]} rotation={[rx, idx * 0.9, rz]} castShadow>
          <coneGeometry args={[0.14, 0.48, 6]} />
          <meshStandardMaterial color={col} roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Large Back-Wall Animated CanvasTexture Dashboard + Neon Sign ---------- */
function BackWallDashboard({ agents, taskRunning }) {
  const signTex = useMemo(() => createNeonSignTexture(), []);
  useEffect(() => () => signTex.dispose(), [signTex]);

  const { dashTex, dashCtx, dashCanvas } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { dashTex: tex, dashCtx: ctx, dashCanvas: canvas };
  }, []);
  useEffect(() => () => dashTex.dispose(), [dashTex]);

  const accRef = useRef(0);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const runningRef = useRef(taskRunning);
  runningRef.current = taskRunning;

  useFrame(({ clock }, delta) => {
    accRef.current += delta;
    if (accRef.current < 0.12) return; // ~8.3 fps canvas redraw = negligible CPU cost
    accRef.current = 0;

    const ctx = dashCtx;
    const t = clock.elapsedTime;
    const W = dashCanvas.width;
    const H = dashCanvas.height;

    ctx.fillStyle = "#091326";
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = "rgba(56,189,248,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Top status bar
    ctx.fillStyle = "#111f38";
    ctx.fillRect(0, 0, W, 38);
    ctx.fillStyle = runningRef.current ? "#22c55e" : "#38bdf8";
    ctx.beginPath();
    ctx.arc(24, 19, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 16px monospace";
    ctx.fillText(runningRef.current ? "MISSION ACTIVE // MULTI-AGENT PIPELINE" : "STUDIO STANDBY // ECONOMY MODE READY", 42, 24);

    // Left panel: Animated multi-wave throughput
    ctx.strokeStyle = "#1e293b";
    ctx.strokeRect(16, 52, 330, 186);
    [
      { c: "#38bdf8", amp: 28, ph: 0 },
      { c: "#a855f7", amp: 20, ph: 1.7 },
      { c: "#22c55e", amp: 14, ph: 3.2 },
    ].forEach((w) => {
      ctx.strokeStyle = w.c;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let x = 28; x <= 334; x += 6) {
        const y = 144 + Math.sin(x * 0.035 + t * (runningRef.current ? 4.5 : 1.6) + w.ph) * w.amp;
        if (x === 28) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // Middle panel: Live cluster bars
    ctx.strokeStyle = "#1e293b";
    ctx.strokeRect(362, 52, 168, 186);
    for (let i = 0; i < 6; i++) {
      const h = 30 + Math.abs(Math.sin(t * (runningRef.current ? 3.8 : 1.3) + i * 0.9)) * 120;
      ctx.fillStyle = i % 2 === 0 ? "#38bdf8" : "#f59e0b";
      ctx.fillRect(378 + i * 24, 224 - h, 14, h);
    }

    // Right panel: Live Agent Roster Tiles
    ctx.strokeStyle = "#1e293b";
    ctx.strokeRect(546, 52, 206, 186);
    const list = agentsRef.current.length
      ? agentsRef.current
      : [
          { name: "Атлас", status: "idle", color: "#38bdf8" },
          { name: "Вектор", status: "idle", color: "#f43f5e" },
          { name: "Нова", status: "idle", color: "#22c55e" },
          { name: "Пульс", status: "idle", color: "#f59e0b" },
          { name: "Шейдер", status: "idle", color: "#a855f7" },
        ];
    list.slice(0, 5).forEach((ag, idx) => {
      const ry = 64 + idx * 34;
      ctx.fillStyle = "#13223b";
      ctx.fillRect(558, ry, 182, 26);
      ctx.fillStyle = ag.color || "#38bdf8";
      ctx.fillRect(558, ry, 5, 26);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText((ag.name || "").toUpperCase(), 572, ry + 17);
      ctx.fillStyle = ag.status === "working" ? "#4ade80" : ag.status === "meeting" ? "#c084fc" : "#94a3b8";
      ctx.font = "11px monospace";
      ctx.fillText((ag.status || "idle").toUpperCase(), 675, ry + 17);
    });

    dashTex.needsUpdate = true;
  });

  return (
    <group position={[0.2, 0, -6.74]}>
      {/* Neon Studio Sign */}
      <mesh position={[0, 3.16, 0]}>
        <planeGeometry args={[4.4, 0.84]} />
        <meshBasicMaterial map={signTex} transparent />
      </mesh>
      {/* Large Command Wall Display */}
      <mesh position={[0, 1.98, 0]} castShadow>
        <boxGeometry args={[5.3, 1.78, 0.08]} />
        <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.98, 0.045]}>
        <planeGeometry args={[5.08, 1.58]} />
        <meshStandardMaterial
          map={dashTex}
          emissiveMap={dashTex}
          emissive="#ffffff"
          emissiveIntensity={0.85}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}

/* ---------- Neon Floor Pathways (Desks -> Conference Pod) ---------- */
function NeonFloor({ active }) {
  const mat = useMemo(() => additive("#38bdf8", 0.2), []);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ clock }) => {
    mat.opacity = active ? 0.34 + Math.sin(clock.elapsedTime * 2.4) * 0.09 : 0.16;
  });

  const strips = useMemo(() => {
    const out = [];
    out.push({ p: [0, 0.012, TABLE_POS.z], s: [12.5, 0.045] });
    out.push({ p: [TABLE_POS.x, 0.012, 0], s: [0.045, 11.2] });
    DESKS.forEach((d) => {
      const [x, , z] = toWorld(d.gx, d.gy);
      const sx = x + 1.2 * d.facing;
      const len = Math.abs(TABLE_POS.z - z);
      out.push({ p: [sx, 0.012, (z + TABLE_POS.z) / 2], s: [0.036, len || 0.01] });
    });
    out.push({ p: [0, 0.012, -6.72], s: [16.6, 0.045] });
    out.push({ p: [-8.22, 0.012, 0], s: [0.045, 13.5] });
    out.push({ p: [8.22, 0.012, 0], s: [0.045, 13.5] });
    return out;
  }, []);

  return (
    <group>
      {strips.map((st, i) => (
        <mesh key={i} geometry={GEO.plane} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={st.p} scale={[st.s[0], st.s[1], 1]} />
      ))}
    </group>
  );
}

/* ---------- Complete Studio Environment ---------- */
export default function OfficeEnvironment({ agents, taskRunning, byId }) {
  return (
    <>
      <color attach="background" args={["#0f172a"]} />
      <fog attach="fog" args={["#0f172a", 24, 48]} />

      {/* Bright, balanced studio lighting */}
      <hemisphereLight args={["#dbeafe", "#334155", 1.15]} />
      <directionalLight
        position={[8, 15, 9]}
        intensity={1.7}
        color="#f8fafc"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={34}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-9, 8, -5]} intensity={0.55} color="#93c5fd" />

      {/* Colored zone point lights */}
      <pointLight position={[0.5, 3.6, -1.0]} intensity={2.4} distance={9} decay={2} color="#38bdf8" />
      <pointLight position={[-0.8, 3.0, -4.8]} intensity={2.5} distance={7.5} decay={2} color="#fbbf24" />
      <pointLight position={[0.0, 2.2, 5.0]} intensity={2.2} distance={6.5} decay={2} color="#22d3ee" />
      <pointLight position={[5.6, 3.2, 1.4]} intensity={1.7} distance={8} decay={2} color="#c084fc" />

      {/* Sleek Polished Concrete Floor via MeshReflectorMaterial */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[17.2, 14.2]} />
        <MeshReflectorMaterial
          color="#1b263b"
          roughness={0.52}
          metalness={0.32}
          resolution={512}
          blur={[220, 70]}
          mixBlur={0.85}
          mixStrength={16}
          mirror={0.35}
          depthScale={0.8}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
        />
      </mesh>
      <gridHelper args={[16, 16, "#27354f", "#1a253b"]} position={[0, 0.004, 0]} />
      <NeonFloor active={taskRunning} />

      {/* Architectural Walls with Acoustic Panels & Overhead LED Strips */}
      <mesh position={[0, 1.8, -6.92]} receiveShadow>
        <boxGeometry args={[17.2, 3.6, 0.22]} />
        <meshStandardMaterial color="#1e293b" roughness={0.62} />
      </mesh>
      <mesh position={[-8.44, 1.8, 0]} receiveShadow>
        <boxGeometry args={[0.22, 3.6, 14.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.62} />
      </mesh>
      <mesh position={[8.44, 1.8, 0]} receiveShadow>
        <boxGeometry args={[0.22, 3.6, 14.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.62} />
      </mesh>

      {/* Wall accent slat panels */}
      {[-6.2, -4.6, 4.8, 6.4].map((px) => (
        <mesh key={px} position={[px, 1.75, -6.79]} receiveShadow>
          <boxGeometry args={[1.15, 2.7, 0.05]} />
          <meshStandardMaterial color="#2b3a52" roughness={0.55} />
        </mesh>
      ))}
      {[-4.2, -0.5, 3.4].map((pz) => (
        <React.Fragment key={pz}>
          <mesh position={[-8.3, 1.75, pz]} receiveShadow>
            <boxGeometry args={[0.05, 2.6, 2.1]} />
            <meshStandardMaterial color="#2b3a52" roughness={0.55} />
          </mesh>
          <mesh position={[8.3, 1.75, pz]} receiveShadow>
            <boxGeometry args={[0.05, 2.6, 2.1]} />
            <meshStandardMaterial color="#2b3a52" roughness={0.55} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Overhead Emissive LED Ceiling Strips */}
      <mesh position={[0, 3.56, -6.66]}>
        <boxGeometry args={[16.5, 0.06, 0.14]} />
        <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[-8.16, 3.56, 0]}>
        <boxGeometry args={[0.14, 0.06, 13.6]} />
        <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[8.16, 3.56, 0]}>
        <boxGeometry args={[0.14, 0.06, 13.6]} />
        <meshStandardMaterial color="#e0f2fe" emissive="#c084fc" emissiveIntensity={1.4} />
      </mesh>
      {/* Suspended ceiling LED light bars over left/right wings */}
      <mesh position={[-5.7, 3.45, 0.5]}>
        <boxGeometry args={[0.1, 0.05, 10.5]} />
        <meshStandardMaterial color="#f8fafc" emissive="#bae6fd" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[5.7, 3.45, 0.5]}>
        <boxGeometry args={[0.1, 0.05, 10.5]} />
        <meshStandardMaterial color="#f8fafc" emissive="#e9d5ff" emissiveIntensity={1.5} />
      </mesh>

      <BackWallDashboard agents={agents} taskRunning={taskRunning} />
      <GlassPartitions />

      {DESKS.map((d) => (
        <Workstation
          key={d.id}
          gx={d.gx}
          gy={d.gy}
          facing={d.facing}
          accent={d.accent}
          screenKind={d.screenKind}
          active={byId[d.id]?.status === "working"}
        />
      ))}

      <ConferencePod active={taskRunning} />
      <LoungeAndCoffeeZone />
      <ServerRoom />

      {/* Potted Studio Plants */}
      <PottedPlant position={[-7.65, 0, -6.15]} scale={1.15} />
      <PottedPlant position={[7.65, 0, -6.15]} scale={1.15} />
      <PottedPlant position={[-1.55, 0, -6.15]} scale={0.95} />
      <PottedPlant position={[2.45, 0, -6.15]} scale={0.95} />
      <PottedPlant position={[-2.05, 0, 5.25]} scale={1.0} />
      <PottedPlant position={[2.05, 0, 5.25]} scale={1.0} />
      <PottedPlant position={[7.65, 0, 5.55]} scale={1.1} />
    </>
  );
}
