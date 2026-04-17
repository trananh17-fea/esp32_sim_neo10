import type { FC } from "react";
import { Check, ShoppingBag, Shield, Tag } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { trackCTA } from "@/services/analytics/webAnalytics";
import { useInView } from "@/hooks/useInView";
import imgMain from "@/assets/img_main.png";

interface ConversionSectionProps {
  onOrderClick?: () => void;
}

const ConversionSection: FC<ConversionSectionProps> = ({ onOrderClick }) => {
  const { t } = useI18n();
  const [cardRef, cardVisible] = useInView<HTMLDivElement>();
  const [headerRef, headerVisible] = useInView<HTMLDivElement>();

  return (
    <section id="pricing-order" className="scroll-mt-12">
      <div className="bg-[#f5f5f7] py-16 sm:py-24">
        <div className="container">

          {/* ── Section header ── */}
          <div
            ref={headerRef}
            className={`text-center reveal${headerVisible ? " is-visible" : ""}`}
          >
            <h2 className="text-section-title text-[#1d1d1f]">
              {t.pricingOrder.heading}
            </h2>
            <p className="mx-auto mt-3 max-w-[26rem] text-base leading-relaxed text-[#4a4a4f]">
              {t.pricingOrder.sub}
            </p>
          </div>

          {/* ── Main card: 2 cột — ảnh trái | giá phải ── */}
          <div
            ref={cardRef}
            className={`mx-auto mt-10 flex max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-md sm:flex-row reveal reveal-scale${cardVisible ? " is-visible" : ""}`}
          >

            {/* LEFT — hình ảnh thực tế sản phẩm */}
            <div className="flex items-center justify-center bg-[#FDF6F0] p-8 sm:w-[42%]">
              <img
                src={imgMain}
                alt="Thiết bị BA.SEW"
                width={220}
                height={220}
                className="h-48 w-auto object-contain drop-shadow-xl sm:h-56"
              />
            </div>

            {/* RIGHT — thông tin giá & tính năng */}
            <div className="flex flex-1 flex-col p-7 sm:p-9">

              {/* Badge GIÁ ƯU ĐÃI — màu cam tạo cảm giác cấp thiết */}
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 ring-1 ring-orange-200">
                <Tag className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-orange-500">
                  Giá ưu đãi
                </span>
              </span>

              {/* Giá — font-black để số to, đậm, nổi bật */}
              <div className="mt-3">
                <p className="text-[clamp(2.6rem,9vw,4rem)] font-black leading-none tracking-tight text-[#1d1d1f]">
                  {t.pricingOrder.price}
                </p>
                <p className="mt-1 text-sm text-[#6e6e73]">{t.pricingOrder.unit}</p>
              </div>

              {/* Danh sách tính năng */}
              <div className="mt-5 space-y-2.5">
                {t.pricingOrder.includes.map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-[#1d1d1f]">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#8B5E3C]/10 text-[#8B5E3C]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Nút đặt hàng */}
              <button
                type="button"
                onClick={() => {
                  onOrderClick?.();
                  trackCTA("open_order_modal", "pricing");
                }}
                className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#8B5E3C] text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-[#6F4A2F] active:scale-[0.97] sos-pulse"
              >
                <ShoppingBag className="h-5 w-5" />
                Đặt hàng ngay
              </button>

              {/* Dòng bảo hành — trust signal */}
              <div className="mt-4 flex items-center gap-1.5 text-xs text-[#6e6e73]">
                <Shield className="h-3.5 w-3.5 shrink-0 text-green-500" />
                <span>
                  Bảo hành{" "}
                  <strong className="text-[#1d1d1f]">12 tháng</strong> — 1 đổi 1 nếu lỗi sản xuất
                </span>
              </div>

            </div>
          </div>

          {/* ── Social-proof strip phía dưới card ── */}
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#6e6e73]">
            <span className="flex items-center gap-1.5">
              <span>✅</span> Đã triển khai thực tế
            </span>
            <span className="hidden text-[#d2d2d7] sm:inline">|</span>
            <span className="flex items-center gap-1.5">
              <span>📦</span> Giao hàng toàn quốc
            </span>
            <span className="hidden text-[#d2d2d7] sm:inline">|</span>
            <span className="flex items-center gap-1.5">
              <span>🔒</span> Thanh toán an toàn
            </span>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ConversionSection;
