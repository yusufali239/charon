import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { DESKS, TABLE_POS, additive, toWorld } from "./OfficeEnvironment";

/* ---------- Shared low-poly character geometries ---------- */
const CHAR_GEO = {
  auraDisc: new THREE.CircleGeometry(1, 24),
  pulseRing: new THREE.RingGeometry(0.82, 1, 28),
  head: new THREE.BoxGeometry(0.27, 0.27, 0.27),
  visor: new THREE.BoxGeometry(0.23, 0.075, 0.025),
  torso: new THREE.CylinderGeometry(0.17, 0.145, 0.44, 12),
  chestPlate: new THREE.BoxGeometry(0.28, 0.26, 0.19),
  pelvis: new THREE.CylinderGeometry(0.145, 0.135, 0.11, 10),
  thigh: new THREE.CapsuleGeometry(0.058, 0.14, 4, 8),
  shin: new THREE.CapsuleGeometry(0.05, 0.14, 4, 8),
  shoe: new THREE.BoxGeometry(0.11, 0.06, 0.17),
  upperArm: new THREE.CapsuleGeometry(0.046, 0.12, 4, 8),
  forearm: new THREE.CapsuleGeometry(0.04, 0.12, 4, 8),
  hand: new THREE.SphereGeometry(0.042, 8, 8),
};

const DESK_BY_ID = Object.fromEntries(DESKS.map((d) => [d.id, d]));

const STATE_META = {
  IDLE: { label: "IDLE", dot: "#94a3b8", badgeBg: "rgba(148,163,184,0.14)", badgeColor: "#cbd5e1", pulse: false, dots: false },
  THINKING: { label: "THINK", dot: "#38bdf8", badgeBg: "rgba(56,189,248,0.18)", badgeColor: "#7dd3fc", pulse: true, dots: true },
  WORKING: { label: "WORK", dot: "#22c55e", badgeBg: "rgba(34,197,94,0.18)", badgeColor: "#86efac", pulse: true, dots: true },
  COLLABORATING: { label: "COLLAB", dot: "#a855f7", badgeBg: "rgba(168,85,247,0.2)", badgeColor: "#d8b4fe", pulse: true, dots: true },
  REVIEWING: { label: "REVIEW", dot: "#eab308", badgeBg: "rgba(234,179,8,0.2)", badgeColor: "#fde047", pulse: true, dots: true },
  BLOCKED: { label: "BLOCKED", dot: "#f97316", badgeBg: "rgba(249,115,22,0.25)", badgeColor: "#fdba74", pulse: true, dots: false },
  ERROR: { label: "ERROR", dot: "#ef4444", badgeBg: "rgba(239,68,68,0.28)", badgeColor: "#fca5a5", pulse: true, dots: false },
  COMPLETED: { label: "DONE", dot: "#10b981", badgeBg: "rgba(16,185,129,0.2)", badgeColor: "#6ee7b7", pulse: false, dots: false },
  WALKING: { label: "MOVE", dot: "#fbbf24", badgeBg: "rgba(245,158,11,0.18)", badgeColor: "#fde68a", pulse: true, dots: false },
  MEETING: { label: "MEET", dot: "#c084fc", badgeBg: "rgba(192,132,252,0.2)", badgeColor: "#e9d5ff", pulse: true, dots: true },
};

function resolveAgentVisualState(agent) {
  const rawVisual = (agent.visual_state || "").toUpperCase();
  const rawStatus = (agent.status || "idle").toLowerCase();
  if (rawStatus === "walking" && (!rawVisual || rawVisual === "IDLE")) return "WALKING";
  if (rawStatus === "meeting" && (!rawVisual || rawVisual === "IDLE")) return "MEETING";
  if (STATE_META[rawVisual]) return rawVisual;
  const upperStatus = rawStatus.toUpperCase();
  if (STATE_META[upperStatus]) return upperStatus;
  if (agent.collaborating_with) return "COLLABORATING";
  return "IDLE";
}

function shortestAngleDiff(current, target) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/* ---------- Floating Check Ring for Quant QA Auditor ---------- */
function FloatingCheckRing({ color = "#eab308" }) {
  const ringRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 1.4;
      ringRef.current.rotation.x = 0.25 + Math.sin(t * 1.8) * 0.12;
      ringRef.current.position.y = 1.52 + Math.sin(t * 2.4) * 0.028;
    }
  });
  return (
    <group ref={ringRef} position={[0, 1.52, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.175, 0.014, 8, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.145, 24]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      {/* Checkmark pips */}
      <mesh position={[-0.025, 0, 0]} rotation={[0, 0, -0.7]}>
        <boxGeometry args={[0.02, 0.06, 0.014]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>
      <mesh position={[0.025, 0.015, 0]} rotation={[0, 0, 0.7]}>
        <boxGeometry args={[0.02, 0.1, 0.014]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>
    </group>
  );
}

/* ---------- Role-specific accessories (Atlas, Vector, Nova, Pulse, Shader, Scout, Quant) ---------- */
function RoleAccessories({ id, color }) {
  if (id === "lead") {
    // Atlas: Commander collar + comms headset & boom mic
    return (
      <group>
        <mesh position={[0, 1.04, -0.02]} castShadow>
          <cylinderGeometry args={[0.19, 0.21, 0.08, 12, 1, true]} />
          <meshStandardMaterial color="#0ea5e9" roughness={0.35} side={THREE.DoubleSide} />
        </mesh>
        {/* Right-ear comms module + mic boom */}
        <mesh position={[0.15, 1.24, 0]} castShadow>
          <boxGeometry args={[0.04, 0.08, 0.08]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} />
        </mesh>
        <mesh position={[0.14, 1.21, 0.08]} rotation={[0.25, -0.35, 0]}>
          <boxGeometry args={[0.015, 0.015, 0.14]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    );
  }
  if (id === "cybersec") {
    // Vector: Tactical shoulder pauldrons + rear antenna + dual cyber-optics
    return (
      <group>
        {[-0.22, 0.22].map((sx) => (
          <mesh key={sx} position={[sx, 1.0, 0]} rotation={[0, 0, sx > 0 ? -0.25 : 0.25]} castShadow>
            <boxGeometry args={[0.12, 0.07, 0.2]} />
            <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[-0.12, 1.18, -0.14]} castShadow>
          <cylinderGeometry args={[0.01, 0.014, 0.26, 6]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        <mesh position={[-0.12, 1.32, -0.14]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    );
  }
  if (id === "dev") {
    // Nova: Over-ear studio headphones + hoodie collar
    return (
      <group>
        <mesh position={[0, 1.25, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.155, 0.022, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.5} />
        </mesh>
        {[-0.155, 0.155].map((ex) => (
          <mesh key={ex} position={[ex, 1.24, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
            <meshStandardMaterial color="#22c55e" roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 1.03, -0.04]} castShadow>
          <torusGeometry args={[0.14, 0.04, 8, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>
      </group>
    );
  }
  if (id === "growth") {
    // Pulse: Sleek amber smart-glasses frame + stylized lapel sash
    return (
      <group>
        <mesh position={[0, 1.25, 0.148]}>
          <boxGeometry args={[0.26, 0.045, 0.02]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.25} />
        </mesh>
        <mesh position={[0.05, 0.86, 0.105]} rotation={[0, 0, -0.55]}>
          <boxGeometry args={[0.06, 0.38, 0.03]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.45} />
        </mesh>
      </group>
    );
  }
  if (id === "motion") {
    // Shader: Asymmetrical cyber-beret/crown + glowing neon collar
    return (
      <group>
        <mesh position={[0.03, 1.38, -0.01]} rotation={[0.1, 0, -0.22]} castShadow>
          <cylinderGeometry args={[0.17, 0.14, 0.07, 14]} />
          <meshStandardMaterial color="#4c1d95" roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.04, 0]}>
          <torusGeometry args={[0.145, 0.022, 8, 18]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    );
  }
  if (id === "scout") {
    // Scout: Cyan holographic scanner visor + dual antenna pack
    return (
      <group>
        {/* Holographic wraparound scanner visor */}
        <mesh position={[0, 1.255, 0.155]}>
          <boxGeometry args={[0.29, 0.09, 0.018]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.72} />
        </mesh>
        <mesh position={[0, 1.305, 0.152]}>
          <boxGeometry args={[0.3, 0.018, 0.026]} />
          <meshStandardMaterial color="#0f172a" metalness={0.75} roughness={0.25} />
        </mesh>
        {[-0.145, 0.145].map((sx) => (
          <mesh key={sx} position={[sx, 1.255, 0.06]} castShadow>
            <boxGeometry args={[0.025, 0.045, 0.18]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
        {/* Targeting reticle pip */}
        <mesh position={[0.095, 1.26, 0.168]}>
          <ringGeometry args={[0.014, 0.022, 16]} />
          <meshBasicMaterial color="#cffafe" side={THREE.DoubleSide} />
        </mesh>
        {/* Dual antenna pack on rear head module */}
        <mesh position={[0, 1.24, -0.155]} castShadow>
          <boxGeometry args={[0.17, 0.15, 0.055]} />
          <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.35} />
        </mesh>
        {[-0.055, 0.055].map((ax, i) => (
          <group key={ax} position={[ax, 1.31, -0.16]} rotation={[0, 0, i === 0 ? 0.14 : -0.14]}>
            <mesh position={[0, 0.11, 0]} castShadow>
              <cylinderGeometry args={[0.008, 0.013, 0.22, 6]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.23, 0]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (id === "quant") {
    // Quant: Gold QA auditor visor + floating check ring
    return (
      <group>
        {/* Gold QA auditor visor + optical caliper */}
        <mesh position={[0, 1.255, 0.15]}>
          <boxGeometry args={[0.28, 0.07, 0.022]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.8} roughness={0.22} />
        </mesh>
        <mesh position={[0, 1.255, 0.163]}>
          <boxGeometry args={[0.24, 0.032, 0.01]} />
          <meshBasicMaterial color="#fde047" />
        </mesh>
        <mesh position={[0.085, 1.255, 0.168]}>
          <cylinderGeometry args={[0.03, 0.03, 0.014, 14]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.8} />
        </mesh>
        <mesh position={[0.15, 1.255, 0.03]} castShadow>
          <boxGeometry args={[0.03, 0.055, 0.22]} />
          <meshStandardMaterial color="#eab308" metalness={0.75} roughness={0.25} />
        </mesh>
        <FloatingCheckRing color={color} />
      </group>
    );
  }
  return null;
}

/* ---------- Neon trail left by walking agents ---------- */
const TRAIL_N = 24;
function AgentTrail({ color, targetRef }) {
  const trail = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(TRAIL_N * 3);
    const col = new Float32Array(TRAIL_N * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < TRAIL_N; i++) {
      const f = (i / (TRAIL_N - 1)) ** 1.6;
      col[i * 3] = c.r * f;
      col[i * 3 + 1] = c.g * f;
      col[i * 3 + 2] = c.b * f;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const l = new THREE.Line(geo, mat);
    l.frustumCulled = false;
    l.userData.acc = 0;
    l.userData.init = false;
    return l;
  }, [color]);

  useEffect(() => () => {
    trail.geometry.dispose();
    trail.material.dispose();
  }, [trail]);

  useFrame((_, delta) => {
    const g = targetRef.current;
    if (!g) return;
    const arr = trail.geometry.attributes.position.array;
    if (!trail.userData.init) {
      for (let i = 0; i < TRAIL_N; i++) {
        arr[i * 3] = g.position.x;
        arr[i * 3 + 1] = 0.03;
        arr[i * 3 + 2] = g.position.z;
      }
      trail.userData.init = true;
    }
    trail.userData.acc += delta;
    if (trail.userData.acc < 0.045) return;
    trail.userData.acc = 0;
    arr.copyWithin(0, 3);
    const h = (TRAIL_N - 1) * 3;
    arr[h] = g.position.x;
    arr[h + 1] = 0.03;
    arr[h + 2] = g.position.z;
    trail.geometry.attributes.position.needsUpdate = true;
  });

  return <primitive object={trail} />;
}

/* ---------- Floor links between collaborating / meeting agents and hub ---------- */
const MAX_LINKS = 8;
export function MeetingLinks({ agents, avatarRefs }) {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 6), 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      color: "#38bdf8",
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const l = new THREE.LineSegments(geo, mat);
    l.frustumCulled = false;
    return l;
  }, []);

  useEffect(() => () => {
    line.geometry.dispose();
    line.material.dispose();
  }, [line]);

  useFrame(({ clock }) => {
    const arr = line.geometry.attributes.position.array;
    let n = 0;
    for (const a of agents) {
      if (n >= MAX_LINKS) break;
      const g = avatarRefs.current[a.id];
      if (!g) continue;
      let ex, ez;
      if (a.collaborating_with) {
        if (a.id > a.collaborating_with) continue;
        const p = avatarRefs.current[a.collaborating_with];
        if (!p) continue;
        ex = p.position.x;
        ez = p.position.z;
      } else if (a.status === "meeting" || (a.visual_state || "").toUpperCase() === "MEETING") {
        ex = TABLE_POS.x;
        ez = TABLE_POS.z;
      } else continue;
      const o = n * 6;
      arr[o] = g.position.x;
      arr[o + 1] = 0.05;
      arr[o + 2] = g.position.z;
      arr[o + 3] = ex;
      arr[o + 4] = 0.05;
      arr[o + 5] = ez;
      n++;
    }
    line.geometry.setDrawRange(0, n * 2);
    line.geometry.attributes.position.needsUpdate = true;
    line.material.opacity = 0.45 + Math.sin(clock.elapsedTime * 4) * 0.25;
  });

  return <primitive object={line} />;
}

/* ---------- Articulated Agent Avatar ---------- */
export function AgentAvatar({ agent, selected, onSelect, avatarRefs }) {
  const groupRef = useRef();
  const bodyRef = useRef();
  const headRef = useRef();
  const leftShoulderRef = useRef();
  const rightShoulderRef = useRef();
  const leftElbowRef = useRef();
  const rightElbowRef = useRef();
  const leftHipRef = useRef();
  const rightHipRef = useRef();
  const leftKneeRef = useRef();
  const rightKneeRef = useRef();
  const auraRef = useRef();
  const pulseRef = useRef();
  const alertBeaconRef = useRef();
  const sitBlendRef = useRef(0);

  const auraMat = useMemo(() => additive(agent.color, 0.0), [agent.color]);
  const pulseMat = useMemo(() => additive(agent.color, 0.0), [agent.color]);

  useEffect(() => () => {
    auraMat.dispose();
    pulseMat.dispose();
  }, [auraMat, pulseMat]);

  const [rawTx, , rawTz] = toWorld(agent.x, agent.y);
  const desk = DESK_BY_ID[agent.id];
  const deskChairPos = useMemo(() => {
    if (!desk) return null;
    const [dx, , dz] = toWorld(desk.gx, desk.gy);
    return { x: dx + 0.72 * desk.facing, z: dz, faceAngle: desk.facing > 0 ? -Math.PI / 2 : Math.PI / 2 };
  }, [desk]);

  const visualState = resolveAgentVisualState(agent);
  const stateMeta = STATE_META[visualState] || STATE_META.IDLE;
  const rawStatus = (agent.status || "idle").toLowerCase();
  const isAlert = visualState === "BLOCKED" || visualState === "ERROR";
  const active =
    rawStatus === "walking" ||
    rawStatus === "meeting" ||
    Boolean(agent.collaborating_with) ||
    visualState === "WORKING" ||
    visualState === "THINKING" ||
    visualState === "COLLABORATING" ||
    visualState === "REVIEWING" ||
    isAlert;

  useEffect(() => {
    avatarRefs.current[agent.id] = groupRef.current;
    return () => {
      delete avatarRefs.current[agent.id];
    };
  }, [agent.id, avatarRefs]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const vs = resolveAgentVisualState(agent);
    const rs = (agent.status || "idle").toLowerCase();

    // Determine if agent is parked at their own desk chair
    let targetX = rawTx;
    let targetZ = rawTz;
    let atDesk = false;

    if (deskChairPos && rs !== "walking" && rs !== "meeting" && !agent.collaborating_with) {
      const distDesk = Math.hypot(rawTx - deskChairPos.x, rawTz - deskChairPos.z);
      if (distDesk < 1.15) {
        atDesk = true;
        targetX = deskChairPos.x;
        targetZ = deskChairPos.z;
      }
    }

    // Subtle client-side separation if two standing/walking agents are too close
    if (!atDesk) {
      let sepX = 0;
      let sepZ = 0;
      const minSep = 0.88;
      for (const [otherId, otherG] of Object.entries(avatarRefs.current)) {
        if (otherId === agent.id || !otherG) continue;
        const ox = g.position.x - otherG.position.x;
        const oz = g.position.z - otherG.position.z;
        const d = Math.hypot(ox, oz);
        if (d > 0.001 && d < minSep) {
          const push = ((minSep - d) / minSep) * 0.42;
          sepX += (ox / d) * push;
          sepZ += (oz / d) * push;
        }
      }
      targetX += sepX;
      targetZ += sepZ;
    }

    const dx = targetX - g.position.x;
    const dz = targetZ - g.position.z;
    const moveDist = Math.hypot(dx, dz);

    const k = Math.min(1, dt * 8.5);
    g.position.x = THREE.MathUtils.lerp(g.position.x, targetX, k);
    g.position.z = THREE.MathUtils.lerp(g.position.z, targetZ, k);

    // Determine facing angle smoothly
    let desiredRotY = g.rotation.y;
    if (moveDist > 0.04) {
      desiredRotY = Math.atan2(dx, dz);
    } else if (atDesk && deskChairPos) {
      desiredRotY = deskChairPos.faceAngle;
    } else if (rs === "meeting" || vs === "MEETING") {
      desiredRotY = Math.atan2(TABLE_POS.x - g.position.x, TABLE_POS.z - g.position.z);
    } else if (agent.collaborating_with && avatarRefs.current[agent.collaborating_with]) {
      const partner = avatarRefs.current[agent.collaborating_with];
      desiredRotY = Math.atan2(partner.position.x - g.position.x, partner.position.z - g.position.z);
    } else if (typeof agent.facing === "number" && Number.isFinite(agent.facing)) {
      desiredRotY = agent.facing;
    }
    g.rotation.y += shortestAngleDiff(g.rotation.y, desiredRotY) * Math.min(1, dt * 10);

    // Pose blending: sitting vs walking vs meeting/inspecting/alert
    const sittingGoal = atDesk && moveDist < 0.25 ? 1 : 0;
    sitBlendRef.current = THREE.MathUtils.lerp(sitBlendRef.current, sittingGoal, Math.min(1, dt * 7));
    const sit = sitBlendRef.current;

    const isWalking = rs === "walking" || vs === "WALKING" || moveDist > 0.14;
    const isWorking = vs === "WORKING" || rs === "working";
    const isThinking = vs === "THINKING";
    const isReviewing = vs === "REVIEWING";
    const isCollaborating = vs === "COLLABORATING" || Boolean(agent.collaborating_with);
    const isMeeting = rs === "meeting" || vs === "MEETING";
    const isBlocked = vs === "BLOCKED";
    const isError = vs === "ERROR";
    const isCompleted = vs === "COMPLETED";
    const swing = isWalking ? Math.sin(t * 10.5) * 0.58 : 0;

    // Body height & lean
    if (bodyRef.current) {
      const walkBob = isWalking ? Math.abs(Math.sin(t * 10.5)) * 0.045 : 0;
      const alertJolt = isError ? Math.sin(t * 20) * 0.018 : isBlocked ? Math.sin(t * 5) * 0.01 : 0;
      bodyRef.current.position.y = THREE.MathUtils.lerp(walkBob, -0.075, sit);
      bodyRef.current.rotation.x = isWalking ? 0.08 : isReviewing ? 0.12 : sit * 0.06;
      bodyRef.current.rotation.z = alertJolt;
    }

    // Articulated Legs (hip + knee)
    if (leftHipRef.current && rightHipRef.current && leftKneeRef.current && rightKneeRef.current) {
      const walkHipL = -swing;
      const walkHipR = swing;
      const walkKneeL = Math.max(0, swing * 0.65);
      const walkKneeR = Math.max(0, -swing * 0.65);

      leftHipRef.current.rotation.x = THREE.MathUtils.lerp(walkHipL, -1.42, sit);
      rightHipRef.current.rotation.x = THREE.MathUtils.lerp(walkHipR, -1.42, sit);
      leftKneeRef.current.rotation.x = THREE.MathUtils.lerp(walkKneeL, 1.42, sit);
      rightKneeRef.current.rotation.x = THREE.MathUtils.lerp(walkKneeR, 1.42, sit);
    }

    // Articulated Arms (shoulder + elbow)
    if (leftShoulderRef.current && rightShoulderRef.current && leftElbowRef.current && rightElbowRef.current) {
      const typingSpeed = isWorking ? 16 : isReviewing ? 9 : 5;
      const typingAmp = isWorking ? 0.15 : isReviewing ? 0.08 : 0.03;
      const typeL = Math.sin(t * typingSpeed) * typingAmp;
      const typeR = -Math.sin(t * typingSpeed + 0.7) * typingAmp;

      // Seated pose variants
      let sitShL = -0.74;
      let sitShR = -0.74;
      let sitElL = -0.76 + typeL;
      let sitElR = -0.76 + typeR;

      if (isThinking) {
        sitShR = -1.12;
        sitElR = -1.28 + Math.sin(t * 2.2) * 0.05;
        sitElL = -0.68;
      } else if (isReviewing) {
        sitShL = -0.82;
        sitShR = -0.98 + Math.sin(t * 2.4) * 0.1;
        sitElL = -0.78;
        sitElR = -0.95 + Math.sin(t * 2.4) * 0.12;
      } else if (isError || isBlocked) {
        const pulseArm = Math.sin(t * (isError ? 12 : 5)) * 0.08;
        sitShL = -0.95 + pulseArm;
        sitShR = -0.95 - pulseArm;
        sitElL = -1.05;
        sitElR = -1.05;
      } else if (isCompleted) {
        sitShL = -0.58;
        sitShR = -0.58;
        sitElL = -0.55;
        sitElR = -0.55;
      }

      // Standing pose variants
      const converseGesture = isMeeting || isCollaborating ? Math.sin(t * 3.6) * 0.18 : 0;
      let standShL = Math.sin(t * 2) * 0.04;
      let standShR = -Math.sin(t * 2) * 0.04;
      let standElL = -0.12;
      let standElR = -0.12;

      if (isWalking) {
        standShL = swing * 0.85;
        standShR = -swing * 0.85;
        standElL = -0.28;
        standElR = -0.28;
      } else if (isMeeting || isCollaborating) {
        standShL = -0.38 + converseGesture;
        standShR = -0.26 - converseGesture;
        standElL = -0.62;
        standElR = -0.45;
      } else if (isReviewing) {
        standShL = -0.32;
        standShR = -0.88;
        standElL = -0.42;
        standElR = -0.95 + Math.sin(t * 2.4) * 0.12;
      } else if (isThinking) {
        standShR = -1.05;
        standElR = -1.22 + Math.sin(t * 2.2) * 0.04;
        standShL = -0.2;
        standElL = -0.35;
      } else if (isError || isBlocked) {
        const pulseArm = Math.sin(t * (isError ? 12 : 5)) * 0.1;
        standShL = -0.68 + pulseArm;
        standShR = -0.68 - pulseArm;
        standElL = -0.88;
        standElR = -0.88;
      } else if (isCompleted) {
        standShL = -0.22;
        standShR = -0.22;
        standElL = -0.3;
        standElR = -0.3;
      }

      leftShoulderRef.current.rotation.x = THREE.MathUtils.lerp(standShL, sitShL, sit);
      rightShoulderRef.current.rotation.x = THREE.MathUtils.lerp(standShR, sitShR, sit);
      leftElbowRef.current.rotation.x = THREE.MathUtils.lerp(standElL, sitElL, sit);
      rightElbowRef.current.rotation.x = THREE.MathUtils.lerp(standElR, sitElR, sit);
    }

    // Head animation across all states
    if (headRef.current) {
      if (isError) {
        headRef.current.rotation.y = Math.sin(t * 14) * 0.16;
        headRef.current.rotation.x = -0.06;
        headRef.current.rotation.z = Math.sin(t * 14) * 0.05;
      } else if (isBlocked) {
        headRef.current.rotation.y = Math.sin(t * 2.4) * 0.22;
        headRef.current.rotation.x = -0.04;
        headRef.current.rotation.z = 0;
      } else if (isReviewing) {
        headRef.current.rotation.y = Math.sin(t * 1.4) * 0.28;
        headRef.current.rotation.x = 0.12 + Math.sin(t * 2.8) * 0.04;
        headRef.current.rotation.z = 0;
      } else if (isThinking) {
        headRef.current.rotation.y = Math.sin(t * 1.1) * 0.14;
        headRef.current.rotation.x = -0.08;
        headRef.current.rotation.z = 0.08;
      } else if (isWorking && sit > 0.5) {
        headRef.current.rotation.y = Math.sin(t * 1.9) * 0.18;
        headRef.current.rotation.x = 0.08 + Math.sin(t * 3.1) * 0.04;
        headRef.current.rotation.z = 0;
      } else if (isMeeting || isCollaborating) {
        headRef.current.rotation.y = Math.sin(t * 1.5) * 0.16;
        headRef.current.rotation.x = Math.sin(t * 3) * 0.03;
        headRef.current.rotation.z = 0;
      } else if (isCompleted) {
        headRef.current.rotation.y = Math.sin(t * 0.8) * 0.06;
        headRef.current.rotation.x = -0.04;
        headRef.current.rotation.z = 0;
      } else {
        headRef.current.rotation.y = Math.sin(t * 0.9) * 0.06;
        headRef.current.rotation.x = 0;
        headRef.current.rotation.z = 0;
      }
    }

    // Overhead alert beacon for BLOCKED / ERROR
    if (alertBeaconRef.current) {
      alertBeaconRef.current.visible = isError || isBlocked;
      if (isError || isBlocked) {
        alertBeaconRef.current.rotation.y = t * (isError ? 5 : 2.8);
        alertBeaconRef.current.position.y = 1.62 + Math.sin(t * (isError ? 9 : 4.5)) * 0.045;
      }
    }

    // Floor neon aura & expanding pulse ring (tinted by state for alert/review/done)
    const ringColor = isError ? "#ef4444" : isBlocked ? "#f97316" : isReviewing ? "#eab308" : isCompleted ? "#10b981" : agent.color;
    auraMat.color.set(ringColor);
    pulseMat.color.set(ringColor);

    const isVisuallyActive =
      isWalking ||
      isMeeting ||
      isCollaborating ||
      isWorking ||
      isThinking ||
      isReviewing ||
      isError ||
      isBlocked;

    const pulseSpeed = isError ? 8 : isBlocked ? 5 : 4;
    const targetOp = isError ? 0.44 : isBlocked ? 0.38 : isVisuallyActive ? 0.32 : isCompleted ? 0.22 : selected ? 0.2 : 0;
    auraMat.opacity = THREE.MathUtils.lerp(
      auraMat.opacity,
      targetOp + (isVisuallyActive ? Math.sin(t * pulseSpeed) * 0.08 : 0),
      Math.min(1, dt * 6)
    );
    if (auraRef.current) auraRef.current.visible = auraMat.opacity > 0.01;
    if (pulseRef.current) {
      const rate = isError ? 1.7 : isBlocked ? 1.2 : 0.9;
      const p = (t * rate) % 1;
      pulseRef.current.visible = isVisuallyActive;
      pulseRef.current.scale.setScalar(0.45 + p * 0.78);
      pulseMat.opacity = (1 - p) * (isError || isBlocked ? 0.78 : 0.58);
    }
  });

  const baseRingColor = isAlert ? stateMeta.dot : agent.color;

  return (
    <>
      <AgentTrail color={agent.color} targetRef={groupRef} />
      <group
        ref={groupRef}
        position={[rawTx, 0, rawTz]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(agent.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        {/* Floor neon aura & selection ring */}
        <mesh ref={auraRef} geometry={CHAR_GEO.auraDisc} material={auraMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]} scale={0.58} />
        <mesh ref={pulseRef} geometry={CHAR_GEO.pulseRing} material={pulseMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.026, 0]}>
          <ringGeometry args={[0.3, selected ? 0.44 : 0.37, 24]} />
          <meshBasicMaterial color={baseRingColor} transparent opacity={selected || active ? 0.95 : 0.55} />
        </mesh>

        {/* Alert beacon crystal for BLOCKED / ERROR */}
        <mesh ref={alertBeaconRef} position={[0, 1.62, 0]} visible={false}>
          <octahedronGeometry args={[0.085, 0]} />
          <meshBasicMaterial color={stateMeta.dot} />
        </mesh>

        {/* Articulated Character Body */}
        <group ref={bodyRef}>
          {/* Pelvis */}
          <mesh geometry={CHAR_GEO.pelvis} position={[0, 0.53, 0]} castShadow>
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>

          {/* Left Leg (Hip -> Thigh -> Knee -> Shin -> Shoe) */}
          <group ref={leftHipRef} position={[-0.095, 0.5, 0]}>
            <mesh geometry={CHAR_GEO.thigh} position={[0, -0.12, 0]} castShadow>
              <meshStandardMaterial color="#1e293b" roughness={0.65} />
            </mesh>
            <group ref={leftKneeRef} position={[0, -0.24, 0]}>
              <mesh geometry={CHAR_GEO.shin} position={[0, -0.12, 0]} castShadow>
                <meshStandardMaterial color="#273449" roughness={0.6} />
              </mesh>
              <mesh geometry={CHAR_GEO.shoe} position={[0, -0.23, 0.035]} castShadow>
                <meshStandardMaterial color="#0f172a" roughness={0.45} />
              </mesh>
            </group>
          </group>

          {/* Right Leg */}
          <group ref={rightHipRef} position={[0.095, 0.5, 0]}>
            <mesh geometry={CHAR_GEO.thigh} position={[0, -0.12, 0]} castShadow>
              <meshStandardMaterial color="#1e293b" roughness={0.65} />
            </mesh>
            <group ref={rightKneeRef} position={[0, -0.24, 0]}>
              <mesh geometry={CHAR_GEO.shin} position={[0, -0.12, 0]} castShadow>
                <meshStandardMaterial color="#273449" roughness={0.6} />
              </mesh>
              <mesh geometry={CHAR_GEO.shoe} position={[0, -0.23, 0.035]} castShadow>
                <meshStandardMaterial color="#0f172a" roughness={0.45} />
              </mesh>
            </group>
          </group>

          {/* Torso Jacket + Accent Chest Core */}
          <mesh geometry={CHAR_GEO.torso} position={[0, 0.8, 0]} castShadow>
            <meshStandardMaterial
              color={agent.color}
              roughness={0.42}
              metalness={0.12}
              emissive={agent.color}
              emissiveIntensity={selected ? 0.32 : 0.08}
            />
          </mesh>
          <mesh geometry={CHAR_GEO.chestPlate} position={[0, 0.82, 0.03]} castShadow>
            <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.3} />
          </mesh>
          {/* Glowing chest badge */}
          <mesh position={[0.06, 0.86, 0.13]}>
            <boxGeometry args={[0.07, 0.025, 0.015]} />
            <meshBasicMaterial color={agent.color} />
          </mesh>

          {/* Left Arm (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand) */}
          <group ref={leftShoulderRef} position={[-0.23, 0.96, 0]}>
            <mesh geometry={CHAR_GEO.upperArm} position={[0, -0.11, 0]} castShadow>
              <meshStandardMaterial color="#334155" roughness={0.5} />
            </mesh>
            <group ref={leftElbowRef} position={[0, -0.21, 0]}>
              <mesh geometry={CHAR_GEO.forearm} position={[0, -0.1, 0]} castShadow>
                <meshStandardMaterial color="#cbd5e1" roughness={0.45} />
              </mesh>
              <mesh geometry={CHAR_GEO.hand} position={[0, -0.2, 0]} castShadow>
                <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
              </mesh>
              {agent.id === "lead" && (
                <mesh position={[0, -0.12, 0.045]}>
                  <boxGeometry args={[0.05, 0.08, 0.015]} />
                  <meshBasicMaterial color={agent.color} />
                </mesh>
              )}
            </group>
          </group>

          {/* Right Arm */}
          <group ref={rightShoulderRef} position={[0.23, 0.96, 0]}>
            <mesh geometry={CHAR_GEO.upperArm} position={[0, -0.11, 0]} castShadow>
              <meshStandardMaterial color="#334155" roughness={0.5} />
            </mesh>
            <group ref={rightElbowRef} position={[0, -0.21, 0]}>
              <mesh geometry={CHAR_GEO.forearm} position={[0, -0.1, 0]} castShadow>
                <meshStandardMaterial color="#cbd5e1" roughness={0.45} />
              </mesh>
              <mesh geometry={CHAR_GEO.hand} position={[0, -0.2, 0]} castShadow>
                <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
              </mesh>
              {agent.id === "growth" && (
                <mesh position={[0, -0.21, 0.05]} rotation={[0.4, 0, 0]}>
                  <boxGeometry args={[0.08, 0.11, 0.015]} />
                  <meshBasicMaterial color="#fbbf24" />
                </mesh>
              )}
            </group>
          </group>

          {/* Head + Glowing Visor + Role Accessories */}
          <group ref={headRef}>
            <mesh geometry={CHAR_GEO.head} position={[0, 1.24, 0]} castShadow>
              <meshStandardMaterial color="#f1f5f9" roughness={0.35} />
            </mesh>
            <mesh geometry={CHAR_GEO.visor} position={[0, 1.25, 0.135]}>
              <meshBasicMaterial color={agent.color} />
            </mesh>
            <RoleAccessories id={agent.id} color={agent.color} />
          </group>
        </group>

        {/* Floating Name Pill & Speech Bubble */}
        <Html position={[0, 1.82, 0]} center distanceFactor={11}>
          <div className="bubble-tag">
            {agent.bubble && <div className="speech-bubble">{agent.bubble}</div>}
            <div
              className={`name-pill${selected ? " selected" : ""}`}
              style={{
                borderColor: isAlert ? stateMeta.dot : agent.color,
                "--agent-color": isAlert ? stateMeta.dot : agent.color,
                boxShadow: isAlert ? `0 0 10px ${stateMeta.dot}66` : undefined,
              }}
            >
              <span
                className={`status-dot${stateMeta.pulse ? " status-working" : ""}`}
                style={{ background: stateMeta.dot }}
              />
              <span>{agent.name}</span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  padding: "1px 5px",
                  borderRadius: "999px",
                  background: stateMeta.badgeBg,
                  color: stateMeta.badgeColor,
                  border: `1px solid ${stateMeta.dot}55`,
                  lineHeight: 1.25,
                }}
              >
                {stateMeta.label}
              </span>
              {stateMeta.dots && (
                <span className="typing-dots small" aria-label="active">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          </div>
        </Html>
      </group>
    </>
  );
}
