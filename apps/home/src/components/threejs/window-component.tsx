import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import { Slider } from "@nextui-org/slider";
import { Card, CardBody, CardFooter, CardHeader } from "@nextui-org/card";
import { Tooltip } from "@nextui-org/tooltip";
import { Button } from "@nextui-org/button";

function WindowFrame({ width, height }: { width: number; height: number }) {
  const frameColor = "#8b4513";
  const frameThickness = 0.05;
  const measurementColor = "#573186";
  const lineThickness = 0.02;
  const textOffset = 0.2;

  return (
    <group>
      <group>
        <mesh position={[0, height / 2 - frameThickness / 2, 0]}>
          <boxGeometry args={[width, frameThickness, frameThickness]} />
          <meshPhongMaterial color={frameColor} />
        </mesh>
        <mesh position={[0, -height / 2 + frameThickness / 2, 0]}>
          <boxGeometry args={[width, frameThickness, frameThickness]} />
          <meshPhongMaterial color={frameColor} />
        </mesh>
        <mesh position={[-width / 2 + frameThickness / 2, 0, 0]}>
          <boxGeometry args={[frameThickness, height, frameThickness]} />
          <meshPhongMaterial color={frameColor} />
        </mesh>
        <mesh position={[width / 2 - frameThickness / 2, 0, 0]}>
          <boxGeometry args={[frameThickness, height, frameThickness]} />
          <meshPhongMaterial color={frameColor} />
        </mesh>
      </group>
      <group>
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

interface SceneProps {
  height: number;
  width: number;
  onHeightChange: (value: number) => void;
  onWidthChange: (value: number) => void;
}

export default async function Scene({
                                      height,
                                      width,
                                      onHeightChange,
                                      onWidthChange,
                                    }: SceneProps) {
  return (
    <div className="flex flex-col sm:min-h-screen md:min-h-full w-screen overflow-y-auto">
      <div className="flex-grow flex flex-col md:flex-row p-4 space-y-4 md:space-y-0 md:space-x-4">
        <div
          className="w-full h-[300px]
                sm:h-[400px] md:h-[500px] lg:h-[600px] xl:h-[600]
                sm:w-[400px] md:w-[600px] lg:w-[800px] xl:w-[900]
                mx-auto dark:bg-black bg-white dark:bg-dot-white/[0.2] bg-dot-black/[0.2]
                border-2 border-primary
                rounded-lg shadow-md overflow-hidden"
        >
          <Canvas>
            <PerspectiveCamera makeDefault position={[0, 0, 5]} />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
            />
            <ambientLight intensity={0.5} />
            <directionalLight position={[1, 1, 1]} intensity={0.8} />
            <WindowFrame width={width} height={height} />
          </Canvas>
        </div>

        <Card className="h-fit ">
          <CardHeader>
            <h2 className="text-lg font-semibold">
              Nhập kích thước cửa sổ của bạn
            </h2>
          </CardHeader>
          <CardBody className="space-y-6 overflow-hidden">
            <div>
              <Slider
                label="Cao (m)"
                size="sm"
                step={0.05}
                maxValue={5}
                minValue={0.5}
                color="foreground"
                classNames={{
                  base: "w-full",
                  label: "text-medium mb-2",
                }}
                renderValue={({ children, ...props }) => (
                  <output {...props} className="ml-2">
                    <Tooltip content="Nhấn Enter để xác nhận" placement="top">
                      <input
                        className="w-16 px-1 py-0.5 text-right text-small bg-default-100 rounded-small border border-transparent hover:border-primary focus:border-primary outline-none"
                        type="text"
                        aria-label="Height value"
                        value={height}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          onHeightChange(Number(e.target.value))
                        }
                        onKeyDown={(
                          e: React.KeyboardEvent<HTMLInputElement>,
                        ) => {
                          if (e.key === "Enter" && !isNaN(Number(height))) {
                            onHeightChange(Number(height));
                          }
                        }}
                      />
                    </Tooltip>
                  </output>
                )}
                value={height}
                onChange={(value) => onHeightChange(Number(value))}
              />
            </div>

            <div>
              <Slider
                label="Rộng (m)"
                size="sm"
                step={0.05}
                maxValue={5}
                minValue={0.5}
                color="foreground"
                classNames={{
                  base: "w-full",
                  label: "text-medium mb-2",
                }}
                renderValue={({ children, ...props }) => (
                  <output {...props} className="ml-2">
                    <Tooltip content="Nhấn Enter để xác nhận" placement="top">
                      <input
                        className="w-16 px-1 py-0.5 text-right text-small bg-default-100 rounded-small border border-transparent hover:border-primary focus:border-primary outline-none"
                        type="text"
                        aria-label="Width value"
                        value={width}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          onWidthChange(Number(e.target.value))
                        }
                        onKeyDown={(
                          e: React.KeyboardEvent<HTMLInputElement>,
                        ) => {
                          if (e.key === "Enter" && !isNaN(Number(width))) {
                            onWidthChange(Number(width));
                          }
                        }}
                      />
                    </Tooltip>
                  </output>
                )}
                value={width}
                onChange={(value) => onWidthChange(Number(value))}
              />

              <Button
                color={"primary"}
                onPress={() => {
                  console.log("height: ", height);
                  console.log("width: ", width);
                }}
              >
                <span>Chọn mẫu cửa sổ</span>
              </Button>
            </div>
          </CardBody>
          <CardFooter className="flex flex-col space-y-2">
            <p>
              Kích thước bạn nên chọn là: <span> (m)</span>
            </p>
            <p className="text-sm text-red-500">
              * Đừng lo nếu kích thước của bạn không có ở trên
            </p>
            <p className="text-sm text-red-500">
              Bạn hãy liên hệ với chúng tôi để chọn mẫu cửa sổ phù hợp nhất.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
