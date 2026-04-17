import { useState, type FC } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BellRing, MapPinned, PhoneCall, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { trackCTA } from "@/services/analytics/webAnalytics";
import { useInView } from "@/hooks/useInView";
import productMain from "@/assets/img_main.png";
import productImg2 from "@/assets/img2.jpg";
import productImg3 from "@/assets/img3.jpg";
import productImg5 from "@/assets/img5.png";
import productImg6 from "@/assets/img6.jpg";

interface FeatureTab {
  icon: LucideIcon;
  label: string;
  desc: string;
  /** which gallery image index to highlight (0-based) */
  highlight: number;
  /** accent color class for the icon bg when active */
  color: string;
}

const featureTabs: FeatureTab[] = [
  {
    icon: BellRing,
    label: "SOS một chạm",
    desc: "Nhấn một lần — thiết bị lập tức phát tín hiệu cảnh báo, không cần mở khóa hay thao tác phức tạp.",
    highlight: 0,
    color: "bg-[#8B5E3C] text-white",
  },
  {
    icon: PhoneCall,
    label: "Tự động gọi điện",
    desc: "Thiết bị tự gọi theo danh sách liên hệ khẩn cấp đã cấu hình sẵn, không cần kết nối internet.",
    highlight: 1,
    color: "bg-[#8B5E3C] text-white",
  },
  {
    icon: MapPinned,
    label: "Chia sẻ vị trí GPS",
    desc: "Toạ độ GPS chính xác được gửi qua SMS kèm link bản đồ để người thân tra cứu ngay lập tức.",
    highlight: 2,
    color: "bg-[#8B5E3C] text-white",
  },
  {
    icon: ShieldCheck,
    label: "Theo dõi qua web",
    desc: "Trang web theo dõi riêng — xem vị trí thời gian thực, lịch sử di chuyển và vùng an toàn.",
    highlight: 3,
    color: "bg-[#8B5E3C] text-white",
  },
];

const galleryImages = [
  { src: productImg2, label: "Góc nhìn 2" },
  { src: productImg3, label: "Góc nhìn 3" },
  { src: productImg6, label: "Góc nhìn 5" },
  { src: productImg5, label: "Góc nhìn 4" },
];

const HeroSection: FC = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<number | null>(null);

  // Scroll-reveal refs
  const [headRef, headVisible] = useInView<HTMLDivElement>();
  const [imgRef, imgVisible] = useInView<HTMLDivElement>();
  const [galleryRef, galleryVisible] = useInView<HTMLDivElement>();
  const [tabsRef, tabsVisible] = useInView<HTMLDivElement>();

  return (
    <section className="overflow-hidden bg-white pb-0 pt-14">
      {/* ── Hero text ── */}
      <div
        ref={headRef}
        className={`container py-16 text-center sm:py-24 reveal${headVisible ? " is-visible" : ""
          }`}
      >
        {/* Brand pill */}
        <span className="inline-flex items-center gap-2 rounded-full bg-[#FDF6F0] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#8B5E3C] ring-1 ring-[#8B5E3C]/20">
          <span className="inline-block h-2 w-2 rounded-full bg-[#8B5E3C] sos-pulse" />
          BA.SEW — Thiết bị khẩn cấp
        </span>

        <h1 className="mx-auto mt-5 max-w-3xl text-hero-xl text-[#1d1d1f]">
          <span className="block">BA.SEW</span>
          <span className="mt-2 block text-[clamp(1.2rem,3vw,1.7rem)] font-medium leading-snug text-[#6e6e73]">
            {t.hero.headline}
          </span>
        </h1>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#demo"
            onClick={() => trackCTA("hero_demo", "hero")}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#8B5E3C] px-7 text-[15px] font-medium text-white shadow-sm transition-all hover:bg-[#6F4A2F] hover:shadow-md active:scale-[0.97]"
          >
            {t.hero.ctaDemo}
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#contact"
            onClick={() => trackCTA("hero_contact", "hero")}
            className="inline-flex h-11 items-center rounded-full border-2 border-[#8B5E3C] px-7 text-[15px] font-medium text-[#8B5E3C] transition-all hover:bg-[#8B5E3C] hover:text-white active:scale-[0.97]"
          >
            {t.hero.ctaOrder}
          </a>
        </div>

        {/* Quick trust badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#6e6e73]">
          <span>✅ Đã triển khai thực tế</span>
          <span className="hidden sm:inline text-[#d2d2d7]">|</span>
          <span>📦 Giao hàng toàn quốc</span>
          <span className="hidden sm:inline text-[#d2d2d7]">|</span>
          <span>🔒 Bảo hành 12 tháng</span>
        </div>
      </div>

      {/* ── Product image ── */}
      <div
        ref={imgRef}
        className={`relative mx-auto max-w-5xl px-4 reveal reveal-scale${imgVisible ? " is-visible" : ""
          }`}
      >
        <div className="relative overflow-hidden rounded-t-3xl bg-[#f5f5f7]">
          <img
            src={productMain}
            alt="Thiết bị BA.SEW"
            className="mx-auto h-[320px] w-full object-cover sm:h-[440px] lg:h-[520px]"
          />
          {/* SOS overlay badge */}
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#8B5E3C] sos-pulse" />
            <span className="text-xs font-semibold text-[#1d1d1f]">SOS Ready</span>
          </div>
        </div>
      </div>

      {/* ── Gallery ── */}
      <div className="bg-[#f5f5f7] pb-4 pt-3">
        <div
          ref={galleryRef}
          className={`mx-auto max-w-5xl px-4 reveal-group${galleryVisible ? " is-visible" : ""
            }`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {galleryImages.map(({ src, label }, i) => (
              <div
                key={i}
                className={`overflow-hidden rounded-2xl bg-white ring-2 transition-all duration-300 ${activeTab !== null && featureTabs[activeTab].highlight === i
                  ? "ring-[#8B5E3C] shadow-lg scale-[1.03]"
                  : "ring-transparent"
                  }`}
              >
                <img
                  src={src}
                  alt={`Sản phẩm BA.SEW – ${label}`}
                  loading="lazy"
                  className={`h-32 w-full object-cover sm:h-40 lg:h-48 transition-all duration-300 ${activeTab !== null && featureTabs[activeTab].highlight !== i
                    ? "opacity-50 grayscale"
                    : "opacity-100"
                    }`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Interactive Feature Tabs ── */}
      <div className="bg-[#f5f5f7] py-10">
        <div className="container">
          <p
            className={`mb-5 text-center text-xs font-semibold uppercase tracking-widest text-[#6e6e73] reveal${tabsVisible ? " is-visible" : ""
              }`}
          >
            Tính năng nổi bật
          </p>

          {/* Tab buttons */}
          <div
            ref={tabsRef}
            className={`reveal-group${tabsVisible ? " is-visible" : ""
              }`}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {featureTabs.map(({ icon: Icon, label }, idx) => {
                const isActive = activeTab === idx;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveTab(isActive ? null : idx)}
                    className={`flex flex-col items-center gap-2.5 rounded-2xl p-5 text-center transition-all duration-200 ${isActive
                      ? "bg-[#8B5E3C] text-white shadow-md scale-[1.04]"
                      : "bg-white text-[#1d1d1f] hover:shadow-md hover:scale-[1.02]"
                      }`}
                  >
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isActive ? "bg-white/20" : "bg-[#f5f5f7]"
                        }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${isActive ? "text-white" : "text-[#8B5E3C]"
                          }`}
                      />
                    </span>
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Feature description panel */}
            <div
              className={`overflow-hidden transition-all duration-300 ${activeTab !== null ? "max-h-40 opacity-100 mt-4" : "max-h-0 opacity-0"
                }`}
            >
              {activeTab !== null && (
                <div className="rounded-2xl bg-white px-6 py-4 ring-1 ring-[#8B5E3C]/20">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FDF6F0]">
                      {(() => {
                        const Icon = featureTabs[activeTab].icon;
                        return <Icon className="h-4 w-4 text-[#8B5E3C]" />;
                      })()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#1d1d1f]">
                        {featureTabs[activeTab].label}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[#6e6e73]">
                        {featureTabs[activeTab].desc}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
