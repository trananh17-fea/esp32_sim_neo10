import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BellRing, MapPinned, PhoneCall, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { trackCTA } from "@/services/analytics/webAnalytics";
import productMain from "@/assets/img_main.png";
import productImg2 from "@/assets/img2.jpg";
import productImg3 from "@/assets/img3.jpg";
import productImg5 from "@/assets/img5.jpg";
import productImg6 from "@/assets/img6.jpg";

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
    <section className="overflow-hidden bg-white pb-0 pt-14">
      {/* Hero text - centered Apple style */}
      <div className="container py-16 text-center sm:py-24">
        <p className="text-sm font-medium tracking-wide text-[#0071e3] sm:text-base">
          Thiết bị cảnh báo khẩn cấp thông minh
        </p>
        <h1 className="mx-auto mt-3 max-w-3xl text-hero-xl text-[#1d1d1f]">
          <span className="block">BE.SEW</span>
          <span className="mt-1 block text-[clamp(1.3rem,3.2vw,1.8rem)] font-medium leading-snug text-[#86868b]">
            {t.hero.headline}
          </span>
        </h1>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#demo"
            onClick={() => trackCTA("hero_demo", "hero")}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0071e3] px-6 text-[15px] font-normal text-white transition-all hover:bg-[#0077ED]"
          >
            {t.hero.ctaDemo}
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#contact"
            onClick={() => trackCTA("hero_contact", "hero")}
            className="inline-flex h-11 items-center rounded-full border border-[#0071e3] px-6 text-[15px] font-normal text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white"
          >
            {t.hero.ctaOrder}
          </a>
        </div>
      </div>

      {/* Product image - full width Apple style */}
      <div className="relative mx-auto max-w-5xl px-4">
        <div className="relative overflow-hidden rounded-t-3xl bg-[#f5f5f7]">
          <img
            src={productMain}
            alt="Thiết bị BA.SEW"
            className="mx-auto h-[320px] w-full object-cover sm:h-[440px] lg:h-[520px]"
          />
        </div>
      </div>

      {/* Product gallery - Apple grid style */}
      <div className="bg-[#f5f5f7] pb-4 pt-3">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { src: productImg2, label: "Góc nhìn 2" },
              { src: productImg3, label: "Góc nhìn 3" },
              { src: productImg5, label: "Góc nhìn 4" },
              { src: productImg6, label: "Góc nhìn 5" },
            ].map(({ src, label }, i) => (
              <div key={i} className="overflow-hidden rounded-2xl bg-white">
                <img
                  src={src}
                  alt={`Sản phẩm BA.SEW – ${label}`}
                  loading="lazy"
                  className="h-32 w-full object-cover sm:h-40 lg:h-48"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature badges - minimal Apple style */}
      <div className="bg-[#f5f5f7] py-8">
        <div className="container">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {featureBadges.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2.5 rounded-2xl bg-white p-5 text-center"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-[#1d1d1f]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
