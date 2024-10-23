"use client"; // This is a comment

import { Switch } from "@nextui-org/switch";
import { motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { cn } from "@/components/lib/server-utils/utils";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  life: number;
}

export default function Mosquito() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  const toggleOverlay = (isSelected: boolean) => {
    setIsOverlayVisible(isSelected);
  };
  const [isDisableParticles, setIsDisableParticles] =
    React.useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 400;

    const particles: Particle[] = [];

    function createParticle() {
      if (!canvas) return;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1;

      return {
        x: centerX,
        y: centerY,
        size: 5,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed,
        life: 10,
      };
    }

    function animate() {
      if (!ctx) return;
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.speedX;
        p.y += p.speedY;
        p.speedX += (Math.random() - 0.5) * 0.1; // Add slight curve
        p.speedY += (Math.random() - 0.5) * 0.1;
        p.life -= 0.01;

        ctx.save(); // Save the current context state
        ctx.shadowColor = "rgba(255, 255, 0, 0.5)"; // Yellow shadow
        ctx.shadowBlur = 10; // Adjust the blur amount as needed

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 0, ${p.life})`; // Set color to yellow with transparency based on life
        ctx.fill();

        ctx.restore(); // Restore the context state

        if (
          p.life <= 0 ||
          p.x < 0 ||
          p.x > canvas.width ||
          p.y < 0 ||
          p.y > canvas.height
        ) {
          particles.splice(i, 1);
          i--;
        }
      }

      if (isDisableParticles) {
        // Clear particles
        particles.splice(0, particles.length);

        return;
      }

      // Add new particles
      if (particles.length < 10) {
        // @ts-ignore
        particles.push(createParticle());
      }

      requestAnimationFrame(animate);
    }

    animate();

    return () => {
      // Clean up if needed
    };
  }, [isDisableParticles]);

  const FADE_DOWN_ANIMATION_VARIANTS = {
    hidden: { opacity: 0, y: -10 },
    show: { opacity: 1, y: 0, transition: { type: "spring" } },
  };

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <motion.div
        className="justify-center items-center"
        initial={{ opacity: 0, y: -10, scale: 0 }}
        variants={{
          hidden: {},
          show: {
            transition: {
              staggerChildren: 0.15,
            },
          },
        }}
        viewport={{ once: true }}
        whileInView={{
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { type: "spring" },
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
          Mau chóng đặt hàng và lắp đặt lưới chống côn trùng
          <br />
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
          className="text-center"
          color="primary"
          size={"lg"}
          onValueChange={(isSelected: boolean) => {
            setIsDisableParticles(isSelected);
            toggleOverlay(isSelected);
          }}
        >
          Ngăn côn trùng xâm nhập
        </Switch>
      </div>
      <div className="relative h-[400px] w-full flex justify-center items-center p-6">
        <div className="relative w-64 h-64">
          {/* Hình vuông tĩnh */}
          <NextImage
            // isBlurred
            // as={NextImage}
            alt={"Window"}
            className={"object-cover"}
            fill={true}
            src={"/src/window.webp"}
          />

          {/* Hình vuông động */}
          {/*<motion.div*/}
          {/*  className="absolute inset-0 bg-gray-800 rounded-lg shadow-lg opacity-70"*/}
          {/*  style={{*/}
          {/*    backgroundImage: `*/}
          {/*    linear-gradient(0deg, transparent 0%, transparent calc(100% - 1px), rgba(0, 0, 0, 0.5) calc(100% - 1px)),*/}
          {/*    linear-gradient(90deg, transparent 0%, transparent calc(100% - 1px), rgba(0, 0, 0, 0.5) calc(100% - 1px))*/}
          {/*  `,*/}
          {/*    backgroundSize: "8px 8px",*/}
          {/*  }}*/}
          {/*  initial={{ y: "-100%" }}*/}
          {/*  animate={{*/}
          {/*    y: isOverlayVisible ? "0%" : "-100%",*/}
          {/*  }}*/}
          {/*  transition={{*/}
          {/*    type: "spring",*/}
          {/*    stiffness: 100,*/}
          {/*    damping: 20,*/}
          {/*  }}*/}
          {/*/>*/}

          {/* Hình vuông động */}
          <motion.div
            animate={{
              scale: isOverlayVisible ? 1 : 0,
              opacity: isOverlayVisible ? 1 : 0,
            }}
            className="absolute inset-0 rounded-lg shadow-lg dark:bg-white dark:bg-opacity-10"
            initial={{ scale: 0, opacity: 0 }}
            style={{
              backgroundImage: `
              linear-gradient(0deg, transparent 0%, transparent calc(100% - 1px), rgba(0, 0, 0, 0.5) calc(100% - 1px)),
              linear-gradient(90deg, transparent 0%, transparent calc(100% - 1px), rgba(0, 0, 0, 0.5) calc(100% - 1px))
            `,
              backgroundSize: "8px 8px",
            }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
            }}
          />
        </div>
        <canvas
          ref={canvasRef}
          className={cn("absolute", isDisableParticles ? "hidden" : "block")}
        />
      </div>
    </div>
  );
}
