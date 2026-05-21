import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Factory,
  Headphones,
  Hourglass,
  Lightbulb,
  Mail,
  PackageCheck,
  PenTool,
  Ruler,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

const features = [
  {
    title: "Sản xuất tại Việt Nam",
    description:
      "Sản phẩm được gia công trực tiếp tại xưởng, dễ tuỳ chỉnh theo thực tế công trình.",
    icon: PackageCheck,
  },
  {
    title: "Chất lượng hàng đầu",
    description:
      "Vật liệu được chọn theo độ bền, khả năng che chắn và độ ổn định khi dùng lâu dài.",
    icon: BadgeCheck,
  },
  {
    title: "Công dụng hiệu quả",
    description:
      "Giảm nắng, bụi và côn trùng nhưng vẫn giữ không gian thông thoáng cho gia đình.",
    icon: ShieldCheck,
  },
  {
    title: "Độ bền cao",
    description:
      "Cấu kiện chắc, dễ vệ sinh và phù hợp với điều kiện sử dụng trong nhà lẫn ban công.",
    icon: Hourglass,
  },
  {
    title: "Chăm sóc khách hàng 24/7",
    description:
      "Đội ngũ tư vấn hỗ trợ nhanh từ lúc đo kích thước đến sau khi lắp đặt.",
    icon: Headphones,
  },
  {
    title: "Thiết kế theo yêu cầu",
    description:
      "Tư vấn mẫu, màu và kiểu lắp phù hợp với từng cửa, từng không gian.",
    icon: PenTool,
  },
  {
    title: "Bảo hành dài hạn",
    description:
      "Chính sách bảo hành rõ ràng, hỗ trợ bảo trì khi khách hàng cần.",
    icon: Ruler,
  },
  {
    title: "Sáng tạo không giới hạn",
    description:
      "Có thể phối rèm, lưới và phụ kiện để đạt đúng phong cách mong muốn.",
    icon: Lightbulb,
  },
];

const guideSteps = [
  {
    title: "Đo kích thước",
    description:
      "Ghi lại chiều ngang, chiều cao và vị trí lắp đặt để chọn cấu hình phù hợp.",
    image: "/src/dokichthuoc.avif",
  },
  {
    title: "Chọn mẫu",
    description:
      "Chọn chất liệu, màu sắc và kiểu hoàn thiện theo nhu cầu sử dụng.",
    image: "/src/chon.avif",
  },
  {
    title: "Điền thông tin",
    description:
      "Gửi thông tin liên hệ để Rèm Việt xác nhận lại đơn và lịch tư vấn.",
    image: "/src/dienthongtin.avif",
  },
  {
    title: "Hoàn tất",
    description:
      "Đội ngũ tiến hành sản xuất, giao hàng và hỗ trợ lắp đặt khi cần.",
    image: "/src/done.avif",
  },
];

const faqs = [
  {
    question:
      "Tôi muốn một kích thước không có trong danh sách, tôi phải làm sao?",
    answer:
      "Bạn hãy liên hệ Rèm Việt và cung cấp kích thước mong muốn. Đội ngũ sẽ tư vấn cấu hình, báo giá và sản xuất theo yêu cầu.",
  },
  {
    question: "Làm thế nào để đặt hàng?",
    answer:
      "Bạn có thể đặt trực tiếp trên website hoặc để lại số điện thoại. Rèm Việt sẽ xác nhận sản phẩm, kích thước và lịch giao lắp.",
  },
  {
    question: "Ưu điểm của Rèm Việt so với sản phẩm khác trên thị trường?",
    answer:
      "Sản phẩm được sản xuất tại Việt Nam, dễ tùy chỉnh kích thước, vật liệu bền và có đội ngũ hỗ trợ sau bán hàng.",
  },
];

const testimonials = [
  {
    quote:
      "Sử dụng sản phẩm của Rèm Việt, tôi rất hài lòng với chất lượng và dịch vụ của họ.",
    name: "Lê Phương Hoàn Mỹ",
    title: "Rất tốt",
  },
  {
    quote: "Sản phẩm chất lượng, giá cả phải chăng, dịch vụ tốt.",
    name: "Mai Tai Sơn",
    title: "Tuyệt vời",
  },
  {
    quote: "Rèm Việt tư vấn nhanh, đo kích thước kỹ và giao đúng mẫu đã chọn.",
    name: "Giang Văn Cốt",
    title: "Rất hài lòng",
  },
  {
    quote:
      "Lưới gọn, thoáng và dễ dùng. Gia đình tôi dùng ở cửa ban công rất ổn.",
    name: "Jon Slow",
    title: "Incredible",
  },
];

const materialItems = [
  "Khung, lưới và phụ kiện được chọn theo độ bền sử dụng thực tế.",
  "Quy trình sản xuất linh hoạt để đáp ứng kích thước riêng của từng cửa.",
  "Bề mặt dễ vệ sinh, phù hợp với cửa sổ, cửa đi và khu vực ban công.",
  "Tối ưu để giữ thoáng khí nhưng vẫn hạn chế côn trùng, bụi và nắng nóng.",
];

const strengthItems = [
  {
    title: "Chất lượng và dịch vụ",
    description:
      "Cam kết sản phẩm chất lượng, giá cả phù hợp và hỗ trợ khách hàng trong suốt quá trình sử dụng.",
    icon: BadgeCheck,
  },
  {
    title: "Độ bền sử dụng lâu dài",
    description:
      "Cấu kiện bền hơn nhiều loại sản phẩm phổ thông, giúp tiết kiệm chi phí thay mới và bảo trì.",
    icon: Wrench,
  },
  {
    title: "Tư vấn miễn phí",
    description:
      "Đội ngũ Rèm Việt hỗ trợ chọn mẫu, đo kích thước và cấu hình sản phẩm theo từng không gian.",
    icon: CircleDollarSign,
  },
];

type Particle = {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  life: number;
};

export function FeatureSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="px-4 text-center">
        <h2 className="mx-auto max-w-5xl text-3xl font-medium tracking-normal text-foreground lg:text-5xl lg:leading-tight">
          Mang đến không gian sống an toàn, tiện nghi
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-normal leading-6 text-muted-foreground lg:text-base">
          Chúng tôi cung cấp các sản phẩm chất lượng, giá cả phải chăng, đảm
          bảo an toàn, tiện nghi cho gia đình bạn. Hãy đến với chúng tôi để
          trải nghiệm ngay hôm nay!
        </p>
      </div>

      <div className="relative z-10 mx-auto mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <div
              className={`group/feature relative flex flex-col py-10 lg:border-r ${
                index === 0 || index === 4 ? "lg:border-l" : ""
              } ${index < 4 ? "lg:border-b" : ""}`}
              key={feature.title}
            >
              <div
                className={`pointer-events-none absolute inset-0 size-full opacity-0 transition duration-200 group-hover/feature:opacity-100 ${
                  index < 4
                    ? "bg-gradient-to-t from-muted to-transparent"
                    : "bg-gradient-to-b from-muted to-transparent"
                }`}
              />
              <div className="relative z-10 mb-4 px-10 text-muted-foreground">
                <Icon aria-hidden className="size-5" />
              </div>
              <div className="relative z-10 mb-2 px-10 text-lg font-bold">
                <div className="absolute inset-y-0 left-0 h-6 w-1 origin-center rounded-r-full bg-muted-foreground/30 transition-all duration-200 group-hover/feature:h-8 group-hover/feature:bg-primary" />
                <span className="inline-block text-foreground transition duration-200 group-hover/feature:translate-x-2">
                  {feature.title}
                </span>
              </div>
              <p className="relative z-10 max-w-xs px-10 text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function GuideSection() {
  return (
    <section className="border-y bg-muted/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">
              Quy trình đặt hàng
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal md:text-3xl">
              Từ đo đạc đến hoàn thiện
            </h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {guideSteps.map((step, index) => (
            <article
              className="overflow-hidden border bg-background shadow-sm"
              key={step.title}
            >
              <div className="aspect-[4/3] bg-muted">
                <img
                  alt={step.title}
                  className="size-full object-cover"
                  loading="lazy"
                  src={step.image}
                />
              </div>
              <div className="p-4">
                <div className="mb-3 flex size-7 items-center justify-center border text-xs font-semibold">
                  {index + 1}
                </div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeNewsletterSection() {
  const trpc = useTRPC();
  const [phone, setPhone] = useState("");
  const newsletter = useMutation(
    trpc.orders.newsletter.mutationOptions({
      onSuccess: () => {
        setPhone("");
        toast.success("Đã ghi nhận thông tin liên hệ.");
      },
    }),
  );

  function submitNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    newsletter.mutate({
      phoneNumber: phone,
      source: "home-newsletter",
    });
  }

  return (
    <section className="mx-auto mb-8 w-full max-w-7xl px-4 py-16 sm:py-24">
      <div className="relative isolate overflow-hidden bg-gray-900 px-6 py-24 text-white shadow-2xl sm:rounded-3xl sm:px-24 xl:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-normal sm:text-4xl">
            Đăng ký nhận thông tin tư vấn.
          </h2>
          <p className="mt-2 text-lg leading-8 text-gray-300">
            Nếu bạn hứng thú với sản phẩm của chúng tôi, hãy để lại Số điện
            thoại để nhận thông tin, chúng tôi sẽ liên hệ với bạn sớm nhất có
            thể.
          </p>
        </div>
        <form
          className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
          onSubmit={submitNewsletter}
        >
          <Input
            aria-label="Số điện thoại tư vấn"
            className="h-12 border-white/20 bg-white px-3 text-foreground"
            inputMode="tel"
            placeholder="0909123456"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Button
            className="h-12 shrink-0 bg-primary px-6 text-primary-foreground shadow-lg hover:bg-primary/90"
            disabled={newsletter.isPending}
            type="submit"
          >
            <Mail aria-hidden />
            {newsletter.isPending ? "Đang gửi..." : "Đăng ký"}
          </Button>
        </form>
      </div>
    </section>
  );
}

export function MosquitoGuardSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    const canvasContext = canvasElement?.getContext("2d");

    if (!canvasElement || !canvasContext) {
      return;
    }

    const canvas = canvasElement;
    const context = canvasContext;

    canvas.width = 400;
    canvas.height = 400;

    const particles: Particle[] = [];
    let animationFrame = 0;

    function createParticle(): Particle {
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
        life: 1,
      };
    }

    function animate() {
      context.clearRect(0, 0, canvas.width, canvas.height);

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];

        if (!particle) {
          continue;
        }

        particle.x += particle.speedX;
        particle.y += particle.speedY;
        particle.speedX += (Math.random() - 0.5) * 0.1;
        particle.speedY += (Math.random() - 0.5) * 0.1;
        particle.life -= 0.01;

        context.save();
        context.shadowColor = "rgba(255, 255, 0, 0.5)";
        context.shadowBlur = 10;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 255, 0, ${particle.life})`;
        context.fill();
        context.restore();

        if (
          particle.life <= 0 ||
          particle.x < 0 ||
          particle.x > canvas.width ||
          particle.y < 0 ||
          particle.y > canvas.height
        ) {
          particles.splice(index, 1);
          index -= 1;
        }
      }

      if (isBlocked) {
        particles.splice(0, particles.length);
      } else if (particles.length < 10) {
        particles.push(createParticle());
      }

      animationFrame = window.requestAnimationFrame(animate);
    }

    animate();

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isBlocked]);

  return (
    <section className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-7xl flex-col items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center justify-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-3 motion-safe:zoom-in-95">
        <h2 className="text-2xl font-bold tracking-normal drop-shadow-sm md:text-7xl">
          Lưới chống các loại côn trùng
        </h2>
        <p className="mt-6 text-base leading-8 text-muted-foreground md:text-2xl">
          Mau chóng đặt hàng và lắp đặt lưới chống côn trùng
          <br />
          để bảo vệ sức khỏe gia đình bạn.
        </p>
        <p className="mx-auto mt-6 flex items-center justify-center text-sm text-muted-foreground md:text-base">
          Còn chần chừ gì nữa, hãy liên hệ ngay với chúng tôi!
        </p>
      </div>

      <label className="mt-6 inline-flex cursor-pointer items-center gap-3 text-sm font-medium">
        <span>Ngăn côn trùng xâm nhập</span>
        <span
          className={`relative inline-flex h-7 w-12 rounded-full border p-0.5 transition-colors ${
            isBlocked ? "bg-primary" : "bg-muted"
          }`}
        >
          <input
            aria-label="Ngăn côn trùng xâm nhập"
            checked={isBlocked}
            className="sr-only"
            role="switch"
            type="checkbox"
            onChange={(event) => setIsBlocked(event.target.checked)}
          />
          <span
            className={`size-6 rounded-full bg-background shadow-sm transition-transform ${
              isBlocked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </label>

      <div className="relative flex size-[400px] max-w-full items-center justify-center p-6">
        <div className="relative size-64">
          <img
            alt="Window"
            className="size-full rounded-lg object-cover"
            src="/src/window.webp"
          />
          <div
            className={`absolute inset-0 rounded-lg shadow-lg transition-all duration-300 ${
              isBlocked ? "scale-100 opacity-100" : "scale-0 opacity-0"
            }`}
            style={{
              backgroundImage: `
                linear-gradient(0deg, transparent 0%, transparent calc(100% - 1px), rgba(0, 0, 0, 0.5) calc(100% - 1px)),
                linear-gradient(90deg, transparent 0%, transparent calc(100% - 1px), rgba(0, 0, 0, 0.5) calc(100% - 1px))
              `,
              backgroundSize: "8px 8px",
            }}
          />
        </div>
        <canvas
          aria-hidden
          className={`absolute ${isBlocked ? "hidden" : "block"}`}
          ref={canvasRef}
        />
      </div>
    </section>
  );
}

export function SizeEstimatorSection() {
  const [height, setHeight] = useState(3);
  const [width, setWidth] = useState(2);
  const previewWidth = Math.max(34, Math.min(80, width * 18));
  const previewHeight = Math.max(40, Math.min(88, height * 18));

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="grid gap-6 border bg-background p-4 shadow-sm lg:grid-cols-[1.2fr_0.8fr] lg:p-6">
        <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-[linear-gradient(to_right,#80808018_1px,transparent_1px),linear-gradient(to_bottom,#80808018_1px,transparent_1px)] bg-[size:28px_28px]">
          <div className="absolute left-4 top-4 text-xs font-semibold uppercase text-muted-foreground">
            Mô phỏng kích thước
          </div>
          <div
            className="relative border-[14px] border-primary/80 bg-background shadow-2xl transition-all duration-300"
            style={{ width: `${previewWidth}%`, height: `${previewHeight}%` }}
          >
            <div className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 bg-primary/50" />
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-primary/50" />
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 border bg-background px-2 py-1 text-xs font-medium">
              Rộng {width.toFixed(2)}m
            </div>
            <div className="absolute -left-11 top-1/2 -translate-y-1/2 -rotate-90 border bg-background px-2 py-1 text-xs font-medium">
              Cao {height.toFixed(2)}m
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">
              Chọn kích thước
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal md:text-3xl">
              Nhập kích thước cửa sổ của bạn
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Nhập chiều cao và chiều rộng để hình dung tỉ lệ cửa trước khi chọn
              mẫu phù hợp.
            </p>
          </div>

          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-medium">
              Cao (m)
              <div className="flex items-center gap-3">
                <input
                  className="w-full accent-primary"
                  max="5"
                  min="0.5"
                  step="0.05"
                  type="range"
                  value={height}
                  onChange={(event) => setHeight(Number(event.target.value))}
                />
                <input
                  className="h-9 w-20 border bg-background px-2 text-right text-sm"
                  max="5"
                  min="0.5"
                  step="0.05"
                  type="number"
                  value={height}
                  onChange={(event) => setHeight(Number(event.target.value))}
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Rộng (m)
              <div className="flex items-center gap-3">
                <input
                  className="w-full accent-primary"
                  max="5"
                  min="0.5"
                  step="0.05"
                  type="range"
                  value={width}
                  onChange={(event) => setWidth(Number(event.target.value))}
                />
                <input
                  className="h-9 w-20 border bg-background px-2 text-right text-sm"
                  max="5"
                  min="0.5"
                  step="0.05"
                  type="number"
                  value={width}
                  onChange={(event) => setWidth(Number(event.target.value))}
                />
              </div>
            </label>
          </div>

          <div className="border bg-muted/40 p-4 text-sm leading-6">
            <p>
              Kích thước đang chọn:{" "}
              <span className="font-semibold">
                {width.toFixed(2)}m x {height.toFixed(2)}m
              </span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Nếu kích thước thực tế khác danh sách có sẵn, Rèm Việt sẽ tư vấn
              mẫu phù hợp theo yêu cầu.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MaterialSection() {
  return (
    <section className="border-y bg-muted/30">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <Factory aria-hidden className="size-4" />
            Vật liệu và quy trình
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal md:text-4xl">
            Vật liệu bền, quy trình sản xuất linh hoạt
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Rèm Việt tập trung vào độ bền, khả năng tùy chỉnh và sự tiện dụng
            khi dùng hằng ngày.
          </p>
        </div>

        <div className="grid gap-3">
          {materialItems.map((item) => (
            <div
              className="flex gap-3 border bg-background p-4 shadow-sm"
              key={item}
            >
              <CheckCircle2
                aria-hidden
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <p className="text-sm leading-6">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function VideoSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">
            Lưới chống muỗi
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal md:text-5xl">
            Dễ dàng lắp đặt, tiện dụng hiệu quả
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Xem nhanh cách sản phẩm vận hành trong không gian thật trước khi
            chọn cấu hình cho cửa nhà bạn.
          </p>
        </div>
        <div className="overflow-hidden border bg-muted shadow-sm">
          <div className="aspect-video">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="size-full"
              src="https://www.youtube.com/embed/iuYum3L2cEg"
              title="Rèm Việt video"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function OurStrengthSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">
            Ưu thế của chúng tôi
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal md:text-4xl">
            Chất lượng bền hơn, hỗ trợ sát hơn
          </h2>
          <div className="mt-5 grid gap-3">
            {strengthItems.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  className="flex gap-3 border bg-background p-4 shadow-sm"
                  key={item.title}
                >
                  <div className="grid size-10 shrink-0 place-items-center bg-primary text-primary-foreground">
                    <Icon aria-hidden className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
          <a
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href="#newsletter"
          >
            Liên hệ ngay
          </a>
        </div>

        <div className="overflow-hidden border bg-muted shadow-sm">
          <div className="aspect-video">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="size-full"
              src="https://www.youtube.com/embed/iuYum3L2cEg?controls=1"
              title="Ưu thế Rèm Việt"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReviewSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase text-primary">
          Đánh giá khách hàng
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-normal md:text-3xl">
          Khách hàng nói gì về chúng tôi?
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {testimonials.map((testimonial) => (
          <article
            className="border bg-background p-4 shadow-sm"
            key={testimonial.name}
          >
            <div className="flex gap-1 text-primary">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star aria-hidden className="size-4 fill-current" key={index} />
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              “{testimonial.quote}”
            </p>
            <div className="mt-5 border-t pt-4">
              <h3 className="text-sm font-semibold">{testimonial.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {testimonial.title}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase text-primary">
          Câu hỏi thường xuyên
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-normal md:text-3xl">
          Những điều khách hàng hay hỏi trước khi đặt hàng
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {faqs.map((faq) => (
          <details
            className="group border bg-background p-4 shadow-sm"
            key={faq.question}
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold">
              {faq.question}
              <ChevronDown
                aria-hidden
                className="mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
