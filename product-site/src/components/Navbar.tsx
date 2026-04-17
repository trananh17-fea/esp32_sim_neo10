import { useState, type FC } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useScrolled } from "@/hooks/useScrolled";
import { useCart } from "@/hooks/useCart";
import BrandLogo from "@/components/BrandLogo";
import CartDropdown from "@/components/CartDropdown";
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

interface NavbarProps {
  onHelpClick?: () => void;
  onOrderClick?: () => void;
  onCheckout?: () => void;
}

const Navbar: FC<NavbarProps> = ({ onHelpClick, onOrderClick, onCheckout }) => {
  const { t } = useI18n();
  const scrolled = useScrolled(16);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const { totalItems, toggleCart } = useCart();

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled
        ? "bg-white/85 backdrop-blur-2xl shadow-[0_1px_0_rgba(0,0,0,0.10)]"
        : "bg-white/70 backdrop-blur-xl"
        }`}
    >
      <div className="container flex h-12 items-center justify-between gap-4">
        <a href="#" className="shrink-0" aria-label="BA.SEW">
          <BrandLogo compact showSubtitle={false} />
        </a>

        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => trackNavbarClick(item.id)}
              className="text-xs font-medium text-[#3a3a3c] transition-colors hover:text-[#1d1d1f]"
            >
              {t.nav[item.key]}
            </a>
          ))}
          <button
            type="button"
            onClick={onHelpClick}
            className="text-xs font-medium text-[#3a3a3c] transition-colors hover:text-[#1d1d1f]"
          >
            Trợ giúp
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Cart icon */}
          <button
            type="button"
            onClick={toggleCart}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1d1d1f] transition-colors hover:bg-black/5"
            aria-label="Giỏ hàng"
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e8340a] px-1 text-[10px] font-bold text-white">
                {totalItems}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { onOrderClick?.(); trackCTA("order_nav", "navbar"); }}
            className="hidden h-[30px] items-center rounded-full bg-[#e8340a] px-4 text-xs font-semibold text-white transition-all hover:bg-[#c92d08] md:inline-flex"
          >
            {t.nav.orderCta}
          </button>

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1d1d1f] transition-colors hover:bg-black/5 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#d2d2d7]/40 bg-white/95 backdrop-blur-2xl px-4 pb-5 pt-3 lg:hidden">
          <div className="container flex flex-col gap-0.5 px-0">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => {
                  setMobileOpen(false);
                  trackNavbarClick(item.id);
                }}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
              >
                {t.nav[item.key]}
              </a>
            ))}
            <button
              type="button"
              onClick={() => { setMobileOpen(false); onHelpClick?.(); }}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#e8340a] transition-colors hover:bg-[#f5f5f7]"
            >
              Trợ giúp
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOrderClick?.();
                trackCTA("order_nav_mobile", "navbar");
              }}
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-[#e8340a] px-5 text-sm font-semibold text-white transition-all hover:bg-[#c92d08]"
            >
              {t.nav.orderCta}
            </button>
          </div>
        </div>
      )}
      <CartDropdown onCheckout={onCheckout} />
    </nav>
  );
};

export default Navbar;
