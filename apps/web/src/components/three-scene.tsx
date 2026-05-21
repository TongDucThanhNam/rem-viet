import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';

export default function ThreeScene({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <div className="size-full min-h-[400px]">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <OrbitControls enablePan={true} enableRotate={true} enableZoom={true} />
        <ambientLight intensity={0.5} />
        <directionalLight intensity={0.8} position={[1, 1, 1]} />
        <WindowFrame height={height} width={width} />
      </Canvas>
    </div>
  );
}

function WindowFrame({ width, height }: { width: number; height: number }) {
  const frameColor = '#8b4513'; // Brown color for the frame
  const frameThickness = 0.05;
  const measurementColor = '#573186'; // Purple color for measurement lines
  const lineThickness = 0.02;
  const textOffset = 0.2;

  const frameGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2);
    shape.lineTo(-width / 2, height / 2);
    shape.lineTo(-width / 2, -height / 2);

    const hole = new THREE.Path();
    hole.moveTo(-width / 2 + frameThickness, -height / 2 + frameThickness);
    hole.lineTo(width / 2 - frameThickness, -height / 2 + frameThickness);
    hole.lineTo(width / 2 - frameThickness, height / 2 - frameThickness);
    hole.lineTo(-width / 2 + frameThickness, height / 2 - frameThickness);
    hole.lineTo(-width / 2 + frameThickness, -height / 2 + frameThickness);

    shape.holes.push(hole);

    const extrudeSettings = {
      steps: 1,
      depth: frameThickness,
      bevelEnabled: false,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [width, height, frameThickness]);

  return (
    <group>
      {/* Window Frame */}
      <mesh geometry={frameGeometry}>
        <meshPhongMaterial color={frameColor} />
      </mesh>

      {/* Measurement Lines */}
      <group>
        {/* Width measurement */}
        <mesh position={[0, height / 2 + textOffset, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[width, lineThickness, lineThickness]} />
          <meshBasicMaterial color={measurementColor} />
        </mesh>
        <Text
          anchorX="center"
          anchorY="bottom"
          color={measurementColor}
          fontSize={0.2}
          position={[0, height / 2 + textOffset * 2, 0]}
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
          anchorX="center"
          anchorY="middle"
          color={measurementColor}
          fontSize={0.2}
          position={[-width / 2 - textOffset * 2, 0, 0]}
          rotation={[0, 0, -Math.PI / 2]}
        >
          {`${height.toFixed(2)}m`}
        </Text>
      </group>
    </group>
  );
}
