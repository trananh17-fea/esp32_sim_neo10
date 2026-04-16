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
    <section id="pricing-order" className="scroll-mt-24 py-12 sm:py-16">
      <div className="container">
        <div className="rounded-[1.8rem] border border-[#E7DED2] bg-gradient-to-b from-white via-white to-[#F8F3ED] p-5 shadow-[0_30px_80px_-55px_rgba(74,52,38,0.75)] sm:p-8">
          <div className="grid items-start gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <article className="rounded-2xl border border-[#E7DED2] bg-white p-5 sm:p-6">
                <h2 className="text-2xl font-bold tracking-tight text-[#2B211B] sm:text-3xl">{t.pricingOrder.heading}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#6E5A4A]">{t.pricingOrder.sub}</p>

                <div className="mt-5 flex items-end gap-2">
                  <span className="text-[clamp(2.3rem,8vw,3.6rem)] font-extrabold leading-none tracking-tight text-[#4A3426]">
                    {t.pricingOrder.price}
                  </span>
                  <span className="pb-1 text-sm font-medium text-[#6E5A4A]">{t.pricingOrder.unit}</span>
                </div>

                <div className="mt-5 space-y-2.5">
                  {t.pricingOrder.includes.map((item) => (
                    <div key={item} className="flex items-start gap-2.5 rounded-xl border border-[#EDE4D9] bg-[#F7F3EE] px-3 py-2.5 text-sm text-[#4A3426]">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6B4F3A]/10 text-[#6B4F3A]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article id="contact" className="rounded-2xl border border-[#E7DED2] bg-white p-5 sm:p-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#6B4F3A]">{t.contact.heading}</p>
                <BrandLogo showSubtitle />

                <div className="mt-4 space-y-3 text-sm">
                  <p className="flex items-center gap-2 text-[#4A3426]">
                    <User className="h-4 w-4 text-[#6B4F3A]" />
                    <span>{t.contact.person}</span>
                  </p>
                  <a
                    href={`tel:${t.contact.phone}`}
                    onClick={() => trackContactClick("phone")}
                    className="flex items-center gap-2 text-[#4A3426] transition-colors hover:text-[#2B211B]"
                  >
                    <Phone className="h-4 w-4 text-[#6B4F3A]" />
                    <span>{t.contact.phone}</span>
                  </a>
                  <a
                    href={`mailto:${t.contact.email}`}
                    onClick={() => trackContactClick("email")}
                    className="flex items-center gap-2 break-all text-[#4A3426] transition-colors hover:text-[#2B211B]"
                  >
                    <Mail className="h-4 w-4 text-[#6B4F3A]" />
                    <span>{t.contact.email}</span>
                  </a>
                </div>

                <div className="mt-5 rounded-2xl border border-[#E7DED2] bg-[#F7F3EE] p-4 sm:p-5">
                  <p className="text-center text-sm font-medium text-[#4A3426]">{t.contact.zaloNote}</p>
                  <div className="mx-auto mt-3 w-[200px] rounded-2xl border border-[#E7DED2] bg-white p-3 shadow-sm sm:w-[230px]">
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
                  className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#6B4F3A] px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#4A3426]"
                >
                  {t.contact.callCta}
                </a>
              </article>
            </div>

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
