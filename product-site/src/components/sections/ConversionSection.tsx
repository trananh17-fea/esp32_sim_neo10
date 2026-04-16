import type { FC } from "react";
import { Check, Mail, Phone, User } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { trackCTA, trackContactClick } from "@/services/analytics/webAnalytics";
import OrderForm from "@/components/sections/OrderForm";
import BrandLogo from "@/components/BrandLogo";
import zaloQr from "@/assets/zalo-qr.jpg";

const ConversionSection: FC = () => {
  const { t } = useI18n();

  return (
    <section id="pricing-order" className="scroll-mt-12">
      {/* Pricing hero - centered */}
      <div className="bg-white py-20 text-center sm:py-28">
        <div className="container">
          <h2 className="text-section-title text-[#1d1d1f]">{t.pricingOrder.heading}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#86868b]">
            {t.pricingOrder.sub}
          </p>
          <div className="mt-8">
            <span className="text-[clamp(2.5rem,8vw,4rem)] font-bold leading-none tracking-tight text-[#1d1d1f]">
              {t.pricingOrder.price}
            </span>
            <span className="ml-2 text-base font-normal text-[#86868b]">{t.pricingOrder.unit}</span>
          </div>
        </div>
      </div>

      {/* Includes + Contact + Order form */}
      <div className="bg-[#f5f5f7] py-16 sm:py-20">
        <div className="container">
          <div className="grid items-start gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            {/* Left column */}
            <div className="space-y-5">
              {/* Includes */}
              <article className="rounded-3xl bg-white p-6 sm:p-8">
                <h3 className="text-lg font-semibold text-[#1d1d1f]">Bao gồm</h3>
                <div className="mt-5 space-y-3">
                  {t.pricingOrder.includes.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 text-sm text-[#1d1d1f]"
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0071e3]/10 text-[#0071e3]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </article>

              {/* Contact */}
              <article id="contact" className="rounded-3xl bg-white p-6 sm:p-8">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-[#0071e3]">
                  {t.contact.heading}
                </p>
                <BrandLogo showSubtitle />

                <div className="mt-5 space-y-3 text-sm">
                  <p className="flex items-center gap-3 text-[#1d1d1f]">
                    <User className="h-4 w-4 text-[#86868b]" />
                    <span>{t.contact.person}</span>
                  </p>
                  <a
                    href={`tel:${t.contact.phone}`}
                    onClick={() => trackContactClick("phone")}
                    className="flex items-center gap-3 text-[#1d1d1f] transition-colors hover:text-[#0071e3]"
                  >
                    <Phone className="h-4 w-4 text-[#86868b]" />
                    <span>{t.contact.phone}</span>
                  </a>
                  <a
                    href={`mailto:${t.contact.email}`}
                    onClick={() => trackContactClick("email")}
                    className="flex items-center gap-3 break-all text-[#1d1d1f] transition-colors hover:text-[#0071e3]"
                  >
                    <Mail className="h-4 w-4 text-[#86868b]" />
                    <span>{t.contact.email}</span>
                  </a>
                </div>

                <div className="mt-6 rounded-2xl bg-[#f5f5f7] p-5">
                  <p className="text-center text-sm font-medium text-[#1d1d1f]">{t.contact.zaloNote}</p>
                  <div className="mx-auto mt-3 w-[200px] overflow-hidden rounded-2xl bg-white p-3 sm:w-[230px]">
                    <img
                      src={zaloQr}
                      alt="QR Zalo BA.SEW"
                      className="h-[174px] w-full rounded-xl object-contain sm:h-[200px]"
                    />
                  </div>
                </div>

                <a
                  href={`tel:${t.contact.phone}`}
                  onClick={() => trackCTA("call_contact", "conversion_section")}
                  className="mt-6 inline-flex h-11 items-center rounded-full bg-[#1d1d1f] px-6 text-sm font-normal text-white transition-all hover:bg-[#000]"
                >
                  {t.contact.callCta}
                </a>
              </article>
            </div>

            {/* Right column - Order form */}
            <div id="order">
              <OrderForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConversionSection;
