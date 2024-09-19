"use client"; // This is a comment

import {cn, Image, Switch} from "@nextui-org/react";
import {motion} from "framer-motion";


import React, {useEffect, useRef} from "react";

interface Particle {
    x: number
    y: number
    size: number
    speedX: number
    speedY: number
    life: number
}

export default function Mosquito() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDisableParticles, setIsDisableParticles] = React.useState(false)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = 400
        canvas.height = 400

        const particles: Particle[] = []

        function createParticle() {
            const centerX = canvas.width / 2
            const centerY = canvas.height / 2
            const angle = Math.random() * Math.PI * 2
            const speed = 1
            return {
                x: centerX,
                y: centerY,
                size: 5,
                speedX: Math.cos(angle) * speed,
                speedY: Math.sin(angle) * speed,
                life: 10,
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            // Update and draw particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i]
                p.x += p.speedX
                p.y += p.speedY
                p.speedX += (Math.random() - 0.5) * 0.1 // Add slight curve
                p.speedY += (Math.random() - 0.5) * 0.1
                p.life -= 0.01

                ctx.save() // Save the current context state
                ctx.shadowColor = 'rgba(255, 255, 0, 0.5)' // Yellow shadow
                ctx.shadowBlur = 10 // Adjust the blur amount as needed

                ctx.beginPath()
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(255, 255, 0, ${p.life})` // Set color to yellow with transparency based on life
                ctx.fill()

                ctx.restore() // Restore the context state

                if (p.life <= 0 || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                    particles.splice(i, 1)
                    i--
                }
            }

            if (isDisableParticles) {
                // Clear particles
                particles.splice(0, particles.length)
                return
            }

            // Add new particles
            if (particles.length < 10) {
                particles.push(createParticle())
            }

            requestAnimationFrame(animate)
        }

        animate()

        return () => {
            // Clean up if needed
        }
    }, [isDisableParticles])

    const FADE_DOWN_ANIMATION_VARIANTS = {
        hidden: {opacity: 0, y: -10},
        show: {opacity: 1, y: 0, transition: {type: "spring"}},
    };

    return (
        <>
            <motion.div
                initial={{opacity: 0, y: -10, scale: 0}}
                // animate="show"
                whileInView={{opacity: 1, y: 0, scale: 1, transition: {type: "spring"}}}
                viewport={{once: true}}
                variants={{
                    hidden: {},
                    show: {
                        transition: {
                            staggerChildren: 0.15,
                        },
                    },
                }}
            >
                <motion.h1
                    className="text-center text-2xl font-bold drop-shadow-sm md:text-7xl"
                    variants={FADE_DOWN_ANIMATION_VARIANTS}
                >
                    Lưới chống các loại côn trùng
                </motion.h1>
                <motion.p
                    className="mt-6 text-center md:text-2xl"
                    variants={FADE_DOWN_ANIMATION_VARIANTS}
                >
                    Mau chóng đặt hàng và lắp đặt lưới
                    chống côn trùng
                    <br/>
                    để bảo vệ sức khỏe gia đình bạn.
                </motion.p>
                <motion.div
                    className="mx-auto mt-6 flex items-center justify-center space-x-5"
                    variants={FADE_DOWN_ANIMATION_VARIANTS}
                >
                    Còn chần chừ gì nữa, hãy liên hệ ngay với chúng tôi!
                </motion.div>
            </motion.div>

            <div className="flex justify-center">
                <Switch
                    value={isDisableParticles}
                    onValueChange={(isSelected) => setIsDisableParticles(isSelected)}
                    className="text-center" size={"lg"} color="primary">
                    Ngăn côn trùng xâm nhập
                </Switch>
            </div>
            <div className="relative h-[400px] w-full overflow-hidden flex justify-center items-center p-6">

                <Image
                    isBlurred
                    className={"justify-center items-center z-0"}
                    src={"/src/window.png"}
                    alt={"Window"}
                    width={250}
                    height={250}
                />

                <canvas ref={canvasRef} className={cn(
                    "absolute",
                    isDisableParticles ? "hidden" : "block"
                )}>
                </canvas>


            </div>
        </>
    );
}