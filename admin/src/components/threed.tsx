"use client"

import {Canvas} from "@react-three/fiber"
import {OrbitControls, PerspectiveCamera} from "@react-three/drei"
import {Slider} from "@nextui-org/slider"
import React, {useState} from "react"
import {Card, CardBody, CardFooter, CardHeader, SliderValue, Tooltip} from "@nextui-org/react"

export function WindowFrame({width, height}: { width: number, height: number }) {
    const frameColor = "#8b4513" // Brown color for the frame
    const frameThickness = 0.1

    return (
        <group>
            {/* Top frame */}
            <mesh position={[0, height / 2 - frameThickness / 2, 0]}>
                <boxGeometry args={[width, frameThickness, frameThickness]}/>
                <meshPhongMaterial color={frameColor}/>
            </mesh>

            {/* Bottom frame */}
            <mesh position={[0, -height / 2 + frameThickness / 2, 0]}>
                <boxGeometry args={[width, frameThickness, frameThickness]}/>
                <meshPhongMaterial color={frameColor}/>
            </mesh>

            {/* Left frame */}
            <mesh position={[-width / 2 + frameThickness / 2, 0, 0]}>
                <boxGeometry args={[frameThickness, height, frameThickness]}/>
                <meshPhongMaterial color={frameColor}/>
            </mesh>

            {/* Right frame */}
            <mesh position={[width / 2 - frameThickness / 2, 0, 0]}>
                <boxGeometry args={[frameThickness, height, frameThickness]}/>
                <meshPhongMaterial color={frameColor}/>
            </mesh>
        </group>
    )
}

export default function Scene() {
    const [height, setHeight] = useState<number>(3)
    const [width, setWidth] = useState<number>(2)

    const handleHeightChange = (value: SliderValue) => {
        if (isNaN(Number(value))) return

        setHeight(Number(value))
    }

    const handleWidthChange = (value: SliderValue) => {
        if (isNaN(Number(value))) return

        setWidth(Number(value))
    }

    return (
        <div className="w-full h-screen flex flex-col md:flex-row">
            <div className="w-full md:w-3/4 h-2/3 md:h-full">
                <Canvas>
                    <PerspectiveCamera makeDefault position={[0, 0, 5]}/>
                    <OrbitControls/>
                    <ambientLight intensity={0.5}/>
                    <directionalLight position={[1, 1, 1]} intensity={0.8}/>
                    <WindowFrame width={width} height={height}/>
                </Canvas>
            </div>

            <Card className="w-full md:w-1/4 h-1/3 md:h-full p-4">
                <CardHeader>
                    <h2 className="text-lg font-semibold">Nhập kích thước cửa sổ của bạn</h2>
                </CardHeader>
                <CardBody>
                    <Slider
                        label="Cao (m)"
                        size="sm"
                        step={0.05}
                        maxValue={3}
                        minValue={0.5}
                        color="foreground"
                        classNames={{
                            base: "max-w-md",
                            label: "text-medium",
                        }}
                        renderValue={({children, ...props}) => (
                            <output {...props}>
                                <Tooltip
                                    className="text-tiny text-default-500 rounded-md"
                                    content={"Nhấn Enter để xác nhận"}
                                    placement="left"
                                >
                                    <input
                                        className="px-1 py-0.5 w-16 text-right text-small text-default-700 font-medium bg-default-100 outline-none transition-colors rounded-small border-medium border-transparent hover:border-primary focus:border-primary"
                                        type="text"
                                        aria-label="Height value"
                                        value={height}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            const v = e.target.value
                                            setHeight(v)
                                        }}
                                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                            if (e.key === "Enter" && !isNaN(Number(height))) {
                                                setHeight(Number(height))
                                            }
                                        }}
                                    />
                                </Tooltip>
                            </output>
                        )}
                        value={height}
                        onChange={handleHeightChange}
                    />

                    <Slider
                        label="Rộng (m)"
                        size="sm"
                        step={0.05}
                        maxValue={3}
                        minValue={0.5}
                        color="foreground"
                        classNames={{
                            base: "max-w-md",
                            label: "text-medium",
                        }}
                        renderValue={({children, ...props}) => (
                            <output {...props}>
                                <Tooltip
                                    className="text-tiny text-default-500 rounded-md"
                                    content={"Nhấn Enter để xác nhận"}
                                    placement="left"
                                >
                                    <input
                                        className="px-1 py-0.5 w-16 text-right text-small text-default-700 font-medium bg-default-100 outline-none transition-colors rounded-small border-medium border-transparent hover:border-primary focus:border-primary"
                                        type="text"
                                        aria-label="Width value"
                                        value={width}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            const v = e.target.value
                                            setWidth(v)
                                        }}
                                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                            if (e.key === "Enter" && !isNaN(Number(width))) {
                                                setWidth(Number(width))
                                            }
                                        }}
                                    />
                                </Tooltip>
                            </output>
                        )}
                        value={width}
                        onChange={handleWidthChange}
                    />
                </CardBody>
                <CardFooter></CardFooter>
            </Card>
        </div>
    )
}