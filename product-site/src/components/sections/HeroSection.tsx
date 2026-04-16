import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BellRing, CircleCheck, MapPinned, PhoneCall, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { trackCTA } from "@/services/analytics/webAnalytics";
import productMain from "@/assets/product-02-2.jpg";

interface FeatureBadge {
  icon: LucideIcon;
  label: string;
}

const featureBadges: FeatureBadge[] = [
  { icon: BellRing, label: "SOS một chạm" },
  { icon: PhoneCall, label: "Tự động gọi điện" },
  { icon: MapPinned, label: "Chia sẻ vị trí" },
  { icon: ShieldCheck, label: "Theo dõi qua web" },
];

const HeroSection: FC = () => {
  const { t } = useI18n();

  return (
    <section className="pb-12 pt-24 sm:pb-16 sm:pt-28">
      <div className="container">
        <div className="rounded-[1.8rem] border border-[#E7DED2] bg-white/95 p-5 shadow-[0_30px_80px_-48px_rgba(74,52,38,0.6)] sm:p-8 lg:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
            <div className="max-w-xl">
              <span className="inline-flex rounded-full border border-[#E7DED2] bg-[#F7F3EE] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#6B4F3A]">
                Thiết bị cảnh báo khẩn cấp thông minh
              </span>
              <h1 className="mt-4 text-[clamp(1.95rem,5.4vw,3.3rem)] font-extrabold leading-[1.08] tracking-tight text-[#2B211B]">
                <span className="block font-display text-[#4A3426]">BA.SEW</span>
                <span className="mt-2 block whitespace-pre-line">{t.hero.headline}</span>
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[#6E5A4A] sm:text-base">{t.hero.sub}</p>

              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:max-w-lg">
                {t.hero.bullets.map((item) => (
                  <div
                    key={item}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E7DED2] bg-[#F7F3EE] px-3 py-2 text-[13px] font-medium leading-snug text-[#4A3426]"
                  >
                    <CircleCheck className="h-4 w-4 shrink-0 text-[#6B4F3A]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#demo"
                  onClick={() => trackCTA("hero_demo", "hero")}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#6B4F3A] px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#4A3426]"
                >
                  {t.hero.ctaDemo}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#contact"
                  onClick={() => trackCTA("hero_contact", "hero")}
                  className="inline-flex h-11 items-center rounded-xl border border-[#D8CCBD] bg-white px-5 text-sm font-semibold text-[#4A3426] transition-colors hover:bg-[#F7F3EE]"
                >
                  {t.hero.ctaOrder}
                </a>
              </div>
            </div>

            <div className="w-full">
              <div className="relative overflow-hidden rounded-[1.6rem] border border-[#E7DED2] bg-gradient-to-br from-[#FAF7F3] via-white to-[#F2E8DC] p-4 shadow-[0_26px_65px_-42px_rgba(74,52,38,0.75)] sm:p-5">
                <img
                  src={productMain}
                  alt="Thiết bị BA.SEW"
                  className="h-[280px] w-full rounded-2xl border border-[#E7DED2] object-cover shadow-[0_24px_55px_-36px_rgba(74,52,38,0.8)] sm:h-[350px] lg:h-[390px]"
                />

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {featureBadges.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex min-h-10 items-center gap-2 rounded-xl border border-[#E7DED2] bg-white px-3 py-2 text-[12px] font-medium leading-snug text-[#4A3426]"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[#6B4F3A]" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="pointer-events-none absolute right-4 top-4 rounded-xl bg-[#4A3426]/90 px-3 py-2 text-xs font-semibold text-white shadow-lg">
                  BA.SEW
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
