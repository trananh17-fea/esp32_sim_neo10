import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
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
import process01 from "@/assets/process-01.jpg";
import process02 from "@/assets/process-02.jpg";
import process03 from "@/assets/process-03.jpg";
import process04 from "@/assets/process-04.jpg";

const uspIcons: LucideIcon[] = [Webhook, ShieldAlert, MapPinCheck, Waves];
const featureIcons: LucideIcon[] = [Siren, Smartphone, Radio, CheckCircle2];

interface ProcessImage {
  src: string;
  alt: string;
}

interface ProcessColumnProps {
  images: ProcessImage[];
}

const leftProcessImages: ProcessImage[] = [
  { src: process01, alt: "Quá trình phát triển BA.SEW 01" },
  { src: process02, alt: "Quá trình phát triển BA.SEW 02" },
];
const rightProcessImages: ProcessImage[] = [
  { src: process03, alt: "Quá trình phát triển BA.SEW 03" },
  { src: process04, alt: "Quá trình phát triển BA.SEW 04" },
];

const ProcessColumn: FC<ProcessColumnProps> = ({ images }) => {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
      {images.map((image) => (
        <figure
          key={image.src}
          className="overflow-hidden rounded-2xl border border-[#E7DED2] bg-white shadow-[0_20px_48px_-38px_rgba(74,52,38,0.72)]"
        >
          <img src={image.src} alt={image.alt} loading="lazy" className="h-32 w-full object-cover sm:h-36 lg:h-44" />
        </figure>
      ))}
    </div>
  );
};

const OverviewSection: FC = () => {
  const { t } = useI18n();

  return (
    <section id="device" className="scroll-mt-24 py-12 sm:py-16">
      <div className="container">
        <div className="mb-6 max-w-3xl sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B4F3A]">
            {t.overview.processHeading}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2B211B] sm:text-3xl">
            {t.overview.heading}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#6E5A4A] sm:text-base">{t.overview.desc}</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)_180px] lg:items-start">
          <ProcessColumn images={leftProcessImages} />

          <div className="rounded-[1.6rem] border border-[#E7DED2] bg-white p-5 shadow-[0_28px_70px_-50px_rgba(74,52,38,0.55)] sm:p-7">
            <div className="grid gap-5">
              <div>
                <p className="text-sm font-semibold text-[#4A3426]">{t.overview.uspHeading}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {t.overview.usps.map((item, index) => {
                    const Icon = uspIcons[index] ?? CheckCircle2;
                    return (
                      <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#E7DED2] bg-[#F7F3EE] p-3.5">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#6B4F3A]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-medium leading-snug text-[#4A3426]">{item}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-[#E7DED2] bg-[#F7F3EE] p-4 sm:p-5">
                <p className="text-sm font-semibold text-[#4A3426]">{t.overview.howHeading}</p>
                <div className="mt-3 grid gap-3">
                  {t.overview.steps.map((step, index) => {
                    const Icon = featureIcons[index] ?? CheckCircle2;
                    return (
                      <article key={step.title} className="flex items-start gap-3 rounded-2xl border border-[#E7DED2] bg-white p-4">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#6B4F3A] text-white">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-[#2B211B]">{step.title.replace(/^\d+\.\s*/, "")}</h3>
                          <p className="mt-1 text-xs leading-relaxed text-[#6E5A4A] sm:text-[13px]">{step.desc}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <p className="rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] p-4 text-sm leading-relaxed text-[#6E5A4A]">
                {t.overview.processDesc}
              </p>
            </div>
          </div>

          <ProcessColumn images={rightProcessImages} />
        </div>
      </div>
    </section>
  );
};

export default OverviewSection;
