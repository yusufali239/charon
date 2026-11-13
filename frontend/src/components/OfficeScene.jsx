import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import OfficeEnvironment, { CAMERA_PRESETS } from "./OfficeEnvironment";
import { AgentAvatar, MeetingLinks } from "./AgentModel";

const DEFAULT_CAM = CAMERA_PRESETS.overview.position;
const DEFAULT_TARGET = CAMERA_PRESETS.overview.target;
const FOCUS_OFFSET = new THREE.Vector3(0, 4.0, 5.2);

/* ---------- Smooth camera focus / follow / presets / reset ---------- */
function CameraRig({ controlsRef, focusId, avatarRefs, resetSignal, cameraPreset }) {
  const { camera } = useThree();
  const mode = useRef("idle"); // idle | focus | follow | preset
  const presetKey = useRef("overview");
  const goal = useMemo(() => new THREE.Vector3(), []);
  const camGoal = useMemo(() => new THREE.Vector3(), []);
  const delta3 = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    mode.current = focusId ? "focus" : "idle";
  }, [focusId]);

  useEffect(() => {
    if (resetSignal) {
      presetKey.current = "overview";
      mode.current = "preset";
    }
  }, [resetSignal]);

  useEffect(() => {
    if (!cameraPreset) return;
    const id = typeof cameraPreset === "string" ? cameraPreset : cameraPreset.id;
    presetKey.current = CAMERA_PRESETS[id] ? id : "overview";
    mode.current = "preset";
  }, [cameraPreset]);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const onStart = () => {
      if (mode.current === "focus") mode.current = "follow";
      else if (mode.current === "preset") mode.current = "idle";
    };
    c.addEventListener("start", onStart);
    return () => c.removeEventListener("start", onStart);
  }, [controlsRef]);

  useFrame((_, dt) => {
    const c = controlsRef.current;
    if (!c || mode.current === "idle") return;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 4.5);

    if (mode.current === "preset") {
      const preset = CAMERA_PRESETS[presetKey.current] || CAMERA_PRESETS.overview;
      c.target.lerp(preset.target, k);
      camera.position.lerp(preset.position, k);
      if (camera.position.distanceToSquared(preset.position) < 0.003) mode.current = "idle";
      return;
    }

    const g = avatarRefs.current[focusId];
    if (!g) return;
    goal.set(g.position.x, 0.85, g.position.z);

    if (mode.current === "focus") {
      camGoal.copy(goal).add(FOCUS_OFFSET);
      c.target.lerp(goal, k);
      camera.position.lerp(camGoal, k);
      if (camera.position.distanceToSquared(camGoal) < 0.004) mode.current = "follow";
    } else {
      delta3.copy(goal).sub(c.target).multiplyScalar(k);
      c.target.add(delta3);
      camera.position.add(delta3);
    }
  });

  return null;
}

export default function OfficeScene({
  agents = [],
  taskRunning = false,
  selectedId = null,
  onSelect = () => {},
  resetSignal = 0,
  cameraPreset = null,
}) {
  const byId = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents]);
  const controlsRef = useRef();
  const avatarRefs = useRef({});

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: DEFAULT_CAM.toArray(), fov: 44 }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.12,
      }}
    >
      <OfficeEnvironment agents={agents} taskRunning={taskRunning} byId={byId} />

      {agents.map((a) => (
        <AgentAvatar key={a.id} agent={a} selected={selectedId === a.id} onSelect={onSelect} avatarRefs={avatarRefs} />
      ))}
      <MeetingLinks agents={agents} avatarRefs={avatarRefs} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={DEFAULT_TARGET.toArray()}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.5}
        maxDistance={24}
        maxPolarAngle={Math.PI / 2.18}
      />
      <CameraRig
        controlsRef={controlsRef}
        focusId={selectedId}
        avatarRefs={avatarRefs}
        resetSignal={resetSignal}
        cameraPreset={cameraPreset}
      />
    </Canvas>
  );
}
