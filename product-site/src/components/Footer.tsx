import type { FC } from "react";
import BrandLogo from "@/components/BrandLogo";
import { useI18n } from "@/i18n/context";

const Footer: FC = () => {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[#E7DED2] bg-[#F7F3EE] py-6">
      <div className="container flex flex-col items-center justify-between gap-3 sm:flex-row">
        <BrandLogo compact showSubtitle={false} className="[&>span]:h-9 [&>span]:w-9 [&>span]:text-xs [&_p]:text-base" />
        <div className="text-center text-xs font-medium text-[#6E5A4A] sm:text-right">
          <p>{t.footer.copy}</p>
          <p className="mt-1">{t.footer.dev}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
