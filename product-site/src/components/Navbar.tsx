import { useState, type FC } from "react";
import { Menu, X } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useScrolled } from "@/hooks/useScrolled";
import BrandLogo from "@/components/BrandLogo";
import { trackCTA, trackNavbarClick } from "@/services/analytics/webAnalytics";

interface NavItem {
  id: string;
  key: "device" | "demo" | "pricing" | "contact";
}

const navItems: NavItem[] = [
  { id: "device", key: "device" },
  { id: "demo", key: "demo" },
  { id: "pricing-order", key: "pricing" },
  { id: "contact", key: "contact" },
];

const Navbar: FC = () => {
  const { t } = useI18n();
  const scrolled = useScrolled(16);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled
          ? "border-b border-[#E7DED2]/90 bg-[#F7F3EE]/90 backdrop-blur-xl shadow-[0_16px_34px_-24px_rgba(74,52,38,0.52)]"
          : "bg-[#F7F3EE]/70 backdrop-blur-lg"
        }`}
    >
      <div className="container flex h-[74px] items-center justify-between gap-3">
        <a href="#" className="shrink-0" aria-label="BA.SEW">
          <BrandLogo compact showSubtitle={false} />
        </a>

        <div className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => trackNavbarClick(item.id)}
              className="text-sm font-medium text-[#6E5A4A] transition-colors hover:text-[#2B211B]"
            >
              {t.nav[item.key]}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#order"
            onClick={() => trackCTA("order_nav", "navbar")}
            className="hidden h-11 items-center rounded-xl bg-[#6B4F3A] px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#4A3426] md:inline-flex"
          >
            {t.nav.orderCta}
          </a>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E7DED2] bg-white text-[#4A3426] transition-colors hover:bg-[#F7F3EE] lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#E7DED2] bg-[#F7F3EE]/95 px-4 pb-4 pt-2 shadow-[0_24px_42px_-30px_rgba(74,52,38,0.65)] lg:hidden">
          <div className="container flex flex-col gap-1 px-0">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => {
                  setMobileOpen(false);
                  trackNavbarClick(item.id);
                }}
                className="rounded-xl px-3 py-3 text-sm font-medium text-[#4A3426] transition-colors hover:bg-white"
              >
                {t.nav[item.key]}
              </a>
            ))}
            <a
              href="#order"
              onClick={() => {
                setMobileOpen(false);
                trackCTA("order_nav_mobile", "navbar");
              }}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-[#6B4F3A] px-4 text-sm font-semibold text-white"
            >
              {t.nav.orderCta}
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
