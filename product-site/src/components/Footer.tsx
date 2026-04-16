import type { FC } from "react";
import BrandLogo from "@/components/BrandLogo";
import { useI18n } from "@/i18n/context";

const Footer: FC = () => {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[#d2d2d7]/50 bg-[#f5f5f7]">
      <div className="container py-5">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <BrandLogo compact showSubtitle={false} className="[&>span]:h-8 [&>span]:w-8 [&>span]:text-xs [&_p]:text-[15px]" />
          <div className="text-center text-xs text-[#86868b] sm:text-right">
            <p>{t.footer.copy}</p>
            <p className="mt-0.5">{t.footer.dev}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
