"use client"; // This is a comment

import {Image, Switch} from "@nextui-org/react";

import React, {useEffect, useState} from "react";

interface Mosquito {
    id: number;
    style: React.CSSProperties;
    animation: string; // Thêm thuộc tính animation
}

export default function Component() {
    const [mosquitos, setMosquitos] = useState<Mosquito[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setMosquitos((prev) => [
                ...prev,
                {
                    id: Date.now(),
                    style: {
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDuration: `5s`,
                    },
                    animation: 'flyFigureEight' // Chọn ngẫu nhiên animation
                },
            ]);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (mosquitos.length > 10) {
            setMosquitos((prev) => prev.slice(1));
        }
    }, [mosquitos]);

    return (
        <>
            <p className="text-center mt-2 text-2xl font-bold tracking-tight sm:text-4xl">
                Lưới chống các loại côn trùng
            </p>
            <p className="mt-6 text-lg leading-8 text-center">
                Mau chóng đặt hàng và lắp đặt lưới chống côn trùng <br/> để bảo vệ sức khỏe gia đình bạn.
            </p>
            <div className="flex justify-center">
                <Switch className="text-center" size={"md"} color="secondary" />
            </div>
            <div className="relative w-full h-max	 overflow-hidden flex justify-center items-center">

                <Image
                    isBlurred
                    className={"justify-center items-center"}
                    src={"/src/window.png"}
                    alt={"Window"}
                    width={250}
                    height={250}
                />
                {mosquitos.map((mosquito) => (
                    <div
                        key={mosquito.id}
                        // className="absolute w-1 h-1 bg-white rounded-full"
                        className="absolute w-3 h-3 rounded-full bg-amber-400 firefly-effect" // Thay đổi class, kích thước

                        style={{
                            ...mosquito.style,
                            animation: `${mosquito.animation} ${mosquito.style.animationDuration} linear infinite`,
                            background: "gold", /* Màu vàng */
                            boxShadow: "0 0 10px gold", /* Hiệu ứng glow ban đầu */
                        }}
                    />
                ))}
                <style>{`

        /* Chuyển động hình số 8 */
        @keyframes flyFigureEight {
          0% { transform: translate(0, 0); }
          12.5% { transform: translate(20px, -30px); }
          25% { transform: translate(40px, 0); }
          37.5% { transform: translate(20px, 30px); }
          50% { transform: translate(0, 0); }
          62.5% { transform: translate(-20px, -30px); }
          75% { transform: translate(-40px, 0); }
          87.5% { transform: translate(-20px, 30px); }
          100% { transform: translate(0, 0); }
        }
        
        /* Animation nhấp nháy */
        @keyframes fireflyBlink {
          0%, 100% {
            opacity: 1;
            background-color: gold; /* Màu vàng */
          }
          50% {
            opacity: 0.5;
            background-color: black; /* Màu đen */
          }
        }
      `}</style>
            </div>
        </>

    );
}