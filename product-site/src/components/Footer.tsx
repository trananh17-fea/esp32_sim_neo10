import type { FC } from "react";
import { Mail, Phone } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useI18n } from "@/i18n/context";
import { trackContactClick } from "@/services/analytics/webAnalytics";
import zaloQr from "@/assets/zalo-qr.jpg";

const Footer: FC = () => {
  const { t } = useI18n();

  return (
    <footer id="contact" className="scroll-mt-12 border-t-2 border-[#e8340a]/30 bg-[#1d1d1f]">
      {/* Contact section */}
      <div className="container py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <BrandLogo compact showSubtitle className="[&_p:first-child]:text-white [&_p:last-child]:text-[#86868b]" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#86868b]">
              Thiết bị cảnh báo khẩn cấp thông minh — SOS một chạm, gọi điện tự động, chia sẻ vị trí GPS.
            </p>
          </div>

          {/* Contact info */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#86868b]">
              {t.contact.heading}
            </p>
            <div className="space-y-3">
              <p className="text-sm font-medium text-white">{t.contact.person}</p>
              <a
                href={`tel:${t.contact.phone}`}
                onClick={() => trackContactClick("phone")}
                className="flex items-center gap-2 text-sm text-[#86868b] transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4" />
                {t.contact.phone}
              </a>
              <a
                href={`mailto:${t.contact.email}`}
                onClick={() => trackContactClick("email")}
                className="flex items-center gap-2 break-all text-sm text-[#86868b] transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4" />
                {t.contact.email}
              </a>
            </div>
            <a
              href={`tel:${t.contact.phone}`}
              onClick={() => trackContactClick("phone")}
              className="mt-5 inline-flex h-9 items-center rounded-full bg-[#e8340a] px-5 text-xs font-semibold text-white transition-all hover:bg-[#c92d08]"
            >
              {t.contact.callCta}
            </a>
          </div>

          {/* Zalo QR */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#86868b]">
              Zalo
            </p>
            <p className="mb-3 text-xs text-[#86868b]">{t.contact.zaloNote}</p>
            <div className="w-28 overflow-hidden rounded-xl bg-white p-2">
              <img
                src={zaloQr}
                alt="QR Zalo BA.SEW"
                className="h-24 w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-[#86868b]">{t.footer.copy}</p>
          <p className="text-xs text-[#86868b]">{t.footer.dev}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
