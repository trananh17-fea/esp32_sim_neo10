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
import fullProcess from "@/assets/full_process.jpg";

const uspIcons: LucideIcon[] = [Webhook, ShieldAlert, MapPinCheck, Waves];
const featureIcons: LucideIcon[] = [Siren, Smartphone, Radio, CheckCircle2];

const OverviewSection: FC = () => {
  const { t } = useI18n();

  return (
    <section id="device" className="scroll-mt-12">
      {/* Main heading - centered Apple style */}
      <div className="bg-white py-20 text-center sm:py-28">
        <div className="container">
          <p className="text-sm font-medium tracking-wide text-[#0071e3]">
            {t.overview.processHeading}
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-section-title text-[#1d1d1f]">
            {t.overview.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#86868b]">
            {t.overview.desc}
          </p>
        </div>
      </div>

      {/* USPs - Gray section */}
      <div className="bg-[#f5f5f7] py-16 sm:py-20">
        <div className="container">
          <h3 className="mb-8 text-center text-xl font-semibold text-[#1d1d1f] sm:text-2xl">
            {t.overview.uspHeading}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.overview.usps.map((item, index) => {
              const Icon = uspIcons[index] ?? CheckCircle2;
              return (
                <div
                  key={item}
                  className="rounded-2xl bg-white p-6 text-center transition-shadow hover:shadow-lg"
                >
                  <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium leading-snug text-[#1d1d1f]">{item}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* How it works - White section */}
      <div className="bg-white py-16 sm:py-20">
        <div className="container">
          <h3 className="mb-10 text-center text-xl font-semibold text-[#1d1d1f] sm:text-2xl">
            {t.overview.howHeading}
          </h3>
          <div className="mx-auto grid max-w-3xl gap-0">
            {t.overview.steps.map((step, index) => {
              const Icon = featureIcons[index] ?? CheckCircle2;
              return (
                <article
                  key={step.title}
                  className="relative flex items-start gap-5 py-6"
                >
                  {/* Connector line */}
                  {index < t.overview.steps.length - 1 && (
                    <span className="absolute left-[23px] top-[56px] h-[calc(100%-32px)] w-px bg-[#d2d2d7]" />
                  )}
                  <span className="relative z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="pt-1">
                    <h4 className="text-base font-semibold text-[#1d1d1f]">
                      {step.title.replace(/^\d+\.\s*/, "")}
                    </h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#86868b]">
                      {step.desc}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* Process images - Gray section */}
      <div className="bg-[#f5f5f7] py-16 sm:py-20">
        <div className="container">
          <p className="mb-2 text-center text-sm font-medium tracking-wide text-[#0071e3]">
            {t.overview.processHeading}
          </p>
          <p className="mx-auto mb-10 max-w-xl text-center text-sm leading-relaxed text-[#86868b]">
            {t.overview.processDesc}
          </p>
          {/* Full process image - tổng hợp 4 quy trình */}
          <div className="overflow-hidden rounded-2xl bg-white">
            <img
              src={fullProcess}
              alt="Toàn bộ quy trình sản xuất BA.SEW"
              loading="lazy"
              className="w-full object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection;
