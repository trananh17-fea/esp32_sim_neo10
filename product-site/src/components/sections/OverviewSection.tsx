import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import {
  CheckCircle2,
  MapPinCheck,
  Radio,
  ShieldAlert,
  Siren,
  Smartphone,
  Waves,
  Webhook,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import fullProcess from "@/assets/full_process.jpg";
import step01 from "@/assets/step1.jpg";
import step02 from "@/assets/step2.jpg";
import step03 from "@/assets/step3.jpg";
import step04 from "@/assets/step4.jpg";

interface ProcessImage {
  src: string;
  alt: string;
}

const processImages: ProcessImage[] = [
  { src: step01, alt: "Bước 1: Chuẩn bị linh kiện & phần cứng" },
  { src: step02, alt: "Bước 2: Chế tạo điện mạch trên Perboard" },
  { src: step03, alt: "Bước 3: Chế tạo Vỏ & Tích hợp" },
  { src: step04, alt: "Bước 4: Lắp ráp & kiểm tra" },
];

const uspIcons: LucideIcon[] = [Webhook, ShieldAlert, MapPinCheck, Waves];
const featureIcons: LucideIcon[] = [Siren, Smartphone, Radio, CheckCircle2];

const OverviewSection: FC = () => {
  const { t } = useI18n();
  const [headRef, headVisible] = useInView<HTMLDivElement>();
  const [uspRef, uspVisible] = useInView<HTMLDivElement>();
  const [stepsRef, stepsVisible] = useInView<HTMLDivElement>();
  const [processRef, processVisible] = useInView<HTMLDivElement>();

  return (
    <section id="device" className="scroll-mt-12">
      {/* Main heading */}
      <div className="bg-white py-20 text-center sm:py-28">
        <div
          ref={headRef}
          className={`container reveal${headVisible ? " is-visible" : ""}`}
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-[#e8340a]">
            {t.overview.processHeading}
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-section-title text-[#1d1d1f]">
            {t.overview.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#4a4a4f]">
            {t.overview.desc}
          </p>
        </div>
      </div>

      {/* Điểm khác biệt + Cách hoạt động - gộp chung */}
      <div className="bg-[#f5f5f7] py-16 sm:py-20">
        <div className="container">

          {/* USPs */}
          <h3 className="mb-8 text-center text-xl font-semibold text-[#1d1d1f] sm:text-2xl">
            {t.overview.uspHeading}
          </h3>
          <div
            ref={uspRef}
            className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 reveal-group${uspVisible ? " is-visible" : ""
              }`}
          >
            {t.overview.usps.map((item, index) => {
              const Icon = uspIcons[index] ?? CheckCircle2;
              return (
                <div
                  key={item}
                  className="rounded-2xl bg-white p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1"
                >
                  <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1ee] text-[#e8340a]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-semibold leading-snug text-[#1d1d1f]">{item}</p>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-12 border-t border-[#d2d2d7]" />

          {/* How it works */}
          <h3 className="mb-8 text-center text-xl font-semibold text-[#1d1d1f] sm:text-2xl">
            {t.overview.howHeading}
          </h3>
          <div
            ref={stepsRef}
            className={`grid gap-4 sm:grid-cols-3 reveal-group${stepsVisible ? " is-visible" : ""
              }`}
          >
            {t.overview.steps.map((step, index) => {
              const Icon = featureIcons[index] ?? CheckCircle2;
              return (
                <div key={step.title} className="relative flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center overflow-hidden">
                  {/* Step number watermark */}
                  <span className="absolute right-3 top-2 text-5xl font-black text-[#f5f5f7] select-none">
                    {index + 1}
                  </span>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e8340a] text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#e8340a]">
                    Bước {index + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-[#1d1d1f]">
                    {step.title.replace(/^\d+\.\s*/, "")}
                  </h4>
                  <p className="text-xs leading-relaxed text-[#4a4a4f]">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Process images - Gray section */}
      <div className="bg-[#f5f5f7] py-16 sm:py-20">
        <div
          ref={processRef}
          className={`container reveal${processVisible ? " is-visible" : ""}`}
        >
          <p className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-[#e8340a]">
            {t.overview.processHeading}
          </p>
          <p className="mx-auto mb-10 max-w-xl text-center text-sm leading-relaxed text-[#4a4a4f]">
            {t.overview.processDesc}
          </p>
          {/* Full process image - tổng hợp 4 quy trình */}
          <div className="mb-6 overflow-hidden rounded-2xl bg-white">
            <img
              src={fullProcess}
              alt="Toàn bộ quy trình sản xuất BA.SEW"
              loading="lazy"
              className="w-full object-contain"
            />
          </div>

          {/* 4 step images - tỉ lệ 4:3 */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {processImages.map((image) => (
              <figure key={image.src} className="overflow-hidden rounded-2xl bg-white">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="px-3 py-2 text-xs font-medium leading-snug text-[#1d1d1f]">
                  {image.alt}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection;
