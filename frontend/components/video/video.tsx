interface ResponsiveVideoProps {
  videoSrc: string;
}

export default function ResponsiveVideo(
  { videoSrc }: ResponsiveVideoProps = {
    videoSrc: "https://rem-viet.hcm.ss.bfcplatform.vn/videoplayback.webm",
  },
) {
  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <div className="relative w-full pb-[56.25%] select-none">
        <video
          className="absolute top-0 left-0 w-full h-full object-cover"
          controls={false}
          autoPlay
          loop
          muted
          playsInline
          preload={"auto"}
          poster={"/src/videoThump.webp"}
        >
          <source src={videoSrc} type="video/mp4" />
          Trình duyệt của bạn không hỗ trợ thẻ video.
        </video>
      </div>
    </div>
  );
}
