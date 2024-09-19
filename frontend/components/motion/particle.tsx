"use client"

import React, {useEffect, useRef} from 'react'

interface Particle {
    x: number
    y: number
    size: number
    speedX: number
    speedY: number
    life: number
}

export default function ParticleEffect() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

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
            const speed = Math.random() * 2 + 1
            return {
                x: centerX,
                y: centerY,
                size: Math.random() * 3 + 1,
                speedX: Math.cos(angle) * speed,
                speedY: Math.sin(angle) * speed,
                life: 1,
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            // Draw square border
            ctx.strokeStyle = 'white'
            ctx.lineWidth = 2
            ctx.strokeRect(0, 0, canvas.width, canvas.height)

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

            // Add new particles
            if (particles.length < 100) {
                particles.push(createParticle())
            }

            requestAnimationFrame(animate)
        }

        animate()

        return () => {
            // Clean up if needed
        }
    }, [])

    return (
        <div className="flex items-center justify-center h-screen bg-gray-900">
            <canvas ref={canvasRef} className="border border-white"></canvas>
        </div>
    )
}