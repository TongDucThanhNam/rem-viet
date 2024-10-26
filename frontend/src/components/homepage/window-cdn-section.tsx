// "use client";
//
// import { useEffect, useState } from "react";
// import Script from "next/script";
// // import { Button } from "@/components/ui/button"
// // import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
// // import { Slider } from "@/components/ui/slider"
// // import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
// import { Slider } from "@nextui-org/slider";
// import { Card, CardBody, CardFooter, CardHeader } from "@nextui-org/card";
// import { Tooltip } from "@nextui-org/tooltip";
// import { Button } from "@nextui-org/button";
//
// export default function CDNScene() {
//   const [threeLoaded, setThreeLoaded] = useState(false);
//   const [height, setHeight] = useState(2);
//   const [width, setWidth] = useState(1.5);
//
//   useEffect(() => {
//     if (threeLoaded) {
//       initThreeScene();
//     }
//   }, [threeLoaded, height, width]);
//
//   function initThreeScene() {
//     // This function will be called after Three.js is loaded
//     const scene = new THREE.Scene();
//     const camera = new THREE.PerspectiveCamera(
//       75,
//       window.innerWidth / window.innerHeight,
//       0.1,
//       1000,
//     );
//     const renderer = new THREE.WebGLRenderer();
//     renderer.setSize(800, 600);
//     document
//       .getElementById("canvas-container")
//       .appendChild(renderer.domElement);
//
//     // Create window frame
//     const frameGeometry = new THREE.BoxGeometry(width, height, 0.1);
//     const frameMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
//     const frame = new THREE.Mesh(frameGeometry, frameMaterial);
//     scene.add(frame);
//
//     camera.position.z = 5;
//
//     const animate = () => {
//       requestAnimationFrame(animate);
//       frame.rotation.x += 0.01;
//       frame.rotation.y += 0.01;
//       renderer.render(scene, camera);
//     };
//     animate();
//   }
//
//   return (
//     <>
//       <Script
//         src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
//         onLoad={() => setThreeLoaded(true)}
//       />
//       <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r132/examples/js/controls/OrbitControls.js" />
//
//       <div className="flex flex-col sm:min-h-screen md:min-h-full w-screen overflow-y-auto">
//         <div className="flex-grow flex flex-col md:flex-row p-4 space-y-4 md:space-y-0 md:space-x-4">
//           <div
//             id="canvas-container"
//             className="w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] xl:h-[600px]
//                       sm:w-[400px] md:w-[600px] lg:w-[800px] xl:w-[900px]
//                       mx-auto dark:bg-black bg-white dark:bg-dot-white/[0.2] bg-dot-black/[0.2]
//                       border-2 border-primary rounded-lg shadow-md overflow-hidden"
//           />
//
//           <Card className="h-fit ">
//             <CardHeader>
//               <h2 className="text-lg font-semibold">
//                 Nhập kích thước cửa sổ của bạn
//               </h2>
//             </CardHeader>
//             <CardBody className="space-y-6 overflow-hidden">
//               <div>
//                 <Slider
//                   label="Cao (m)"
//                   size="sm"
//                   step={0.05}
//                   maxValue={5}
//                   minValue={0.5}
//                   color="foreground"
//                   classNames={{
//                     base: "w-full",
//                     label: "text-medium mb-2",
//                   }}
//                   renderValue={({ children, ...props }) => (
//                     <output {...props} className="ml-2">
//                       <Tooltip content="Nhấn Enter để xác nhận" placement="top">
//                         <input
//                           className="w-16 px-1 py-0.5 text-right text-small bg-default-100 rounded-small border border-transparent hover:border-primary focus:border-primary outline-none"
//                           type="text"
//                           aria-label="Height value"
//                           value={height}
//                           // onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
//                           //   onHeightChange(Number(e.target.value))
//                           // }
//                           // onKeyDown={(
//                           //   e: React.KeyboardEvent<HTMLInputElement>,
//                           // ) => {
//                           //   if (e.key === "Enter" && !isNaN(Number(height))) {
//                           //     onHeightChange(Number(height));
//                           //   }
//                           // }}
//                         />
//                       </Tooltip>
//                     </output>
//                   )}
//                   value={height}
//                   // onChange={(value) => onHeightChange(Number(value))}
//                 />
//               </div>
//
//               <div>
//                 <Slider
//                   label="Rộng (m)"
//                   size="sm"
//                   step={0.05}
//                   maxValue={5}
//                   minValue={0.5}
//                   color="foreground"
//                   classNames={{
//                     base: "w-full",
//                     label: "text-medium mb-2",
//                   }}
//                   renderValue={({ children, ...props }) => (
//                     <output {...props} className="ml-2">
//                       <Tooltip content="Nhấn Enter để xác nhận" placement="top">
//                         <input
//                           className="w-16 px-1 py-0.5 text-right text-small bg-default-100 rounded-small border border-transparent hover:border-primary focus:border-primary outline-none"
//                           type="text"
//                           aria-label="Width value"
//                           value={width}
//                           // onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
//                           //   onWidthChange(Number(e.target.value))
//                           // }
//                           // onKeyDown={(
//                           //   e: React.KeyboardEvent<HTMLInputElement>,
//                           // ) => {
//                           //   if (e.key === "Enter" && !isNaN(Number(width))) {
//                           //     onWidthChange(Number(width));
//                           //   }
//                           // }}
//                         />
//                       </Tooltip>
//                     </output>
//                   )}
//                   value={width}
//                   // onChange={(value) => onWidthChange(Number(value))}
//                 />
//
//                 <Button
//                   color={"primary"}
//                   onPress={() => {
//                     console.log("height: ", height);
//                     console.log("width: ", width);
//                   }}
//                 >
//                   <span>Chọn mẫu cửa sổ</span>
//                 </Button>
//               </div>
//             </CardBody>
//             <CardFooter className="flex flex-col space-y-2">
//               <p>
//                 Kích thước bạn nên chọn là: <span> (m)</span>
//               </p>
//               <p className="text-sm text-red-500">
//                 * Đừng lo nếu kích thước của bạn không có ở trên
//               </p>
//               <p className="text-sm text-red-500">
//                 Bạn hãy liên hệ với chúng tôi để chọn mẫu cửa sổ phù hợp nhất.
//               </p>
//             </CardFooter>
//           </Card>
//         </div>
//       </div>
//     </>
//   );
// }
