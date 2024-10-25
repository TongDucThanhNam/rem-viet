"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import React from "react";

export default function ThreeScene({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <Canvas>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[1, 1, 1]} intensity={0.8} />
      <WindowFrame width={width} height={height} />
    </Canvas>
  );
}

function WindowFrame({ width, height }: { width: number; height: number }) {
  const frameColor = "#8b4513"; // Brown color for the frame
  const frameThickness = 0.05;
  const measurementColor = "#573186"; // Red color for measurement lines
  const lineThickness = 0.02;
  const textOffset = 0.2;

  return (
    <group>
      {/* Window Frame */}
      <group>
        {/* Top frame */}
        <mesh position={[0, height / 2 - frameThickness / 2, 0]}>
          <boxGeometry args={[width, frameThickness, frameThickness]} />
          <meshPhongMaterial color={frameColor} />
        </mesh>

        {/* Bottom frame */}
        <mesh position={[0, -height / 2 + frameThickness / 2, 0]}>
          <boxGeometry args={[width, frameThickness, frameThickness]} />
          <meshPhongMaterial color={frameColor} />
        </mesh>

        {/* Left frame */}
        <mesh position={[-width / 2 + frameThickness / 2, 0, 0]}>
          <boxGeometry args={[frameThickness, height, frameThickness]} />
          <meshPhongMaterial color={frameColor} />
        </mesh>

        {/* Right frame */}
        <mesh position={[width / 2 - frameThickness / 2, 0, 0]}>
          <boxGeometry args={[frameThickness, height, frameThickness]} />
          <meshPhongMaterial color={frameColor} />
        </mesh>
      </group>

      {/* Measurement Lines */}
      <group>
        {/* Width measurement */}
        <mesh position={[0, height / 2 + textOffset, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[width, lineThickness, lineThickness]} />
          <meshBasicMaterial color={measurementColor} />
        </mesh>
        <Text
          position={[0, height / 2 + textOffset * 2, 0]}
          color={measurementColor}
          fontSize={0.2}
          anchorX="center"
          anchorY="bottom"
        >
          {`${width.toFixed(2)}m`}
        </Text>

        {/* Height measurement */}
        <mesh
          position={[-width / 2 - textOffset, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <boxGeometry args={[height, lineThickness, lineThickness]} />
          <meshBasicMaterial color={measurementColor} />
        </mesh>
        <Text
          position={[-width / 2 - textOffset * 2, 0, 0]}
          color={measurementColor}
          fontSize={0.2}
          anchorX="center"
          anchorY="middle"
          rotation={[0, 0, -Math.PI / 2]}
        >
          {`${height.toFixed(2)}m`}
        </Text>
      </group>
    </group>
  );
}
