import "./parallaxStyle.css";
import {useRef} from "react";
import {motion, MotionValue, useScroll, useSpring, useTransform} from "framer-motion";
import NextImage from "next/image";

const imageUrls = [
    "https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzv7svt4s219e6",
    "https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzv7svt4mfrhfb",
    "https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzv7svu8ktk1ba",
    "https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzv7svvcj735ba",
    "https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzv7svu909jh5f",
    "https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzv7svu8ktald5",
    "https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzv7svt4nubxc0",
    "https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzljj38w5db5f3",
    "https://down-vn.img.susercontent.com/file/vn-11134207-7r98o-lzv7svt4p8wdd3"
];

function useParallax(value: MotionValue<number>, distance: number) {
    return useTransform(value, [0, 1], [-distance, distance]);
}

function Image({id}: { id: number }) {
    const ref = useRef(null);
    const {scrollYProgress} = useScroll({target: ref});
    const y = useParallax(scrollYProgress, 300);

    return (
        <section>
            <div ref={ref}>
                <NextImage src={id} alt={"123"} width={200} height={200}/>
            </div>
            <motion.h2 style={{y}}>{`#00${id}`}</motion.h2>
        </section>
    );
}

export default function ParallaxComponent() {
    const {scrollYProgress} = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    return (
        <>
            {imageUrls.map((image) => (
                <Image id={image}/>
            ))}
            <motion.div className="progress" style={{scaleX}}/>
        </>
    );
}
