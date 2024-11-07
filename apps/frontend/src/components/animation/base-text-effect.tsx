// "use client";
// import { motion, Variants } from "framer-motion";
// import React from "react";
//
// import { cn } from "@/components/lib/utils";
//
// type PresetType = "blur" | "shake" | "scale" | "fade" | "slide";
// const defaultContainerVariants: Variants = {
//   hidden: { opacity: 0 },
//   visible: {
//     opacity: 1,
//     transition: {
//       staggerChildren: 0.05,
//     },
//   },
//   exit: {
//     transition: { staggerChildren: 0.05, staggerDirection: -1 },
//   },
// };
//
// const defaultItemVariants: Variants = {
//   hidden: { opacity: 0 },
//   visible: {
//     opacity: 1,
//   },
//   exit: { opacity: 0 },
// };
//
// const presetVariants: Record<
//   PresetType,
//   { container: Variants; item: Variants }
// > = {
//   blur: {
//     container: defaultContainerVariants,
//     item: {
//       hidden: { opacity: 0, filter: "blur(12px)" },
//       visible: { opacity: 1, filter: "blur(0px)" },
//       exit: { opacity: 0, filter: "blur(12px)" },
//     },
//   },
//   shake: {
//     container: defaultContainerVariants,
//     item: {
//       hidden: { x: 0 },
//       visible: { x: [-5, 5, -5, 5, 0], transition: { duration: 0.5 } },
//       exit: { x: 0 },
//     },
//   },
//   scale: {
//     container: defaultContainerVariants,
//     item: {
//       hidden: { opacity: 0, scale: 0 },
//       visible: { opacity: 1, scale: 1 },
//       exit: { opacity: 0, scale: 0 },
//     },
//   },
//   fade: {
//     container: defaultContainerVariants,
//     item: {
//       hidden: { opacity: 0 },
//       visible: { opacity: 1 },
//       exit: { opacity: 0 },
//     },
//   },
//   slide: {
//     container: defaultContainerVariants,
//     item: {
//       hidden: { opacity: 0, y: 20 },
//       visible: { opacity: 1, y: 0 },
//       exit: { opacity: 0, y: 20 },
//     },
//   },
// };
//
// const AnimationComponent: React.FC<{
//   segment: string;
//   variants: Variants;
//   per: "line" | "word" | "char";
//   segmentWrapperClassName?: string;
// }> = React.memo(({ segment, variants, per, segmentWrapperClassName }) => {
//   const content =
//     per === "line" ? (
//       <motion.span className="block" variants={variants}>
//         {segment}
//       </motion.span>
//     ) : per === "word" ? (
//       <motion.span
//         aria-hidden="true"
//         className="inline-block whitespace-pre"
//         variants={variants}
//       >
//         {segment}
//       </motion.span>
//     ) : (
//       <motion.span className="inline-block whitespace-pre">
//         {segment.split("").map((char, charIndex) => (
//           <motion.span
//             key={`char-${charIndex}`}
//             aria-hidden="true"
//             className="inline-block whitespace-pre"
//             variants={variants}
//           >
//             {char}
//           </motion.span>
//         ))}
//       </motion.span>
//     );
//
//   if (!segmentWrapperClassName) {
//     return content;
//   }
//
//   const defaultWrapperClassName = per === "line" ? "block" : "inline-block";
//
//   return (
//     <span className={cn(defaultWrapperClassName, segmentWrapperClassName)}>
//       {content}
//     </span>
//   );
// });
//
// AnimationComponent.displayName = "AnimationComponent";
