import type { FC } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { trackCTA } from "@/services/analytics/webAnalytics";

interface ConversionSectionProps {
  onOrderClick?: () => void;
}

const ConversionSection: FC<ConversionSectionProps> = ({ onOrderClick }) => {
  const { t } = useI18n();

  return (
    <section id="pricing-order" className="scroll-mt-12">
      <div className="bg-[#f5f5f7] py-16 text-center sm:py-20">
        <div className="container">
          <p className="text-sm font-medium tracking-wide text-[#0071e3]">{t.pricingOrder.heading}</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-section-title text-[#1d1d1f]">{t.pricingOrder.heading}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#86868b]">{t.pricingOrder.sub}</p>

          {/* Price display */}
          <div className="mx-auto mt-10 max-w-sm rounded-3xl bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3]">Giá ưu đãi</p>
            <div className="mt-3 flex items-baseline justify-center">
              <span className="text-[clamp(2.8rem,10vw,4.5rem)] font-bold leading-none tracking-tight text-[#1d1d1f]">
                {t.pricingOrder.price}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#86868b]">{t.pricingOrder.unit}</p>

            {/* Includes */}
            <div className="mt-6 space-y-2.5 text-left">
              {t.pricingOrder.includes.map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0071e3]/10 text-[#0071e3]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => { onOrderClick?.(); trackCTA("open_order_modal", "pricing"); }}
              className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] text-[15px] font-medium text-white transition-all hover:bg-[#0077ED]"
            >
              <ShoppingBag className="h-5 w-5" />
              Đặt hàng ngay
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConversionSection;
