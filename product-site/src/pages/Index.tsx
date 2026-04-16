import type { FC } from "react";
import {
  Navbar,
  Footer,
  HeroSection,
  OverviewSection,
  DemoSection,
  ConversionSection,
  CheckoutSection,
} from "@/components";
import { useState } from "react";
import OrderModal from "@/components/OrderModal";

const Index: FC = () => {
  const [helpOpen, setHelpOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  return (
    <main className="min-h-screen bg-white">
      <Navbar
        onHelpClick={() => setHelpOpen(true)}
        onOrderClick={() => setOrderOpen(true)}
        onCheckout={() => setCheckoutOpen(true)}
      />
      <HeroSection />
      <OverviewSection />
      <DemoSection />
      <ConversionSection onOrderClick={() => setOrderOpen(true)} />
      <Footer />
      <OrderModal isOpen={orderOpen} onClose={() => setOrderOpen(false)} />
      <CheckoutSection isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setHelpOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">Trợ giúp</h2>
              <button type="button" onClick={() => setHelpOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#86868b] hover:bg-[#f5f5f7]">
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <p className="text-sm font-semibold text-[#1d1d1f]">📦 Đặt hàng như thế nào?</p>
                <p className="mt-1 text-xs leading-relaxed text-[#86868b]">Chọn màu sắc và số lượng tại mục "Đặt mua", nhấn "Thêm vào giỏ hàng", sau đó nhấn icon túi xách trên menu để thanh toán.</p>
              </div>
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <p className="text-sm font-semibold text-[#1d1d1f]">🚚 Phí vận chuyển?</p>
                <p className="mt-1 text-xs leading-relaxed text-[#86868b]">Miễn phí vận chuyển toàn quốc cho tất cả đơn hàng BA.SEW.</p>
              </div>
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <p className="text-sm font-semibold text-[#1d1d1f]">💳 Thanh toán bằng gì?</p>
                <p className="mt-1 text-xs leading-relaxed text-[#86868b]">Hỗ trợ thanh toán khi nhận hàng (COD) và chuyển khoản ngân hàng.</p>
              </div>
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <p className="text-sm font-semibold text-[#1d1d1f]">📞 Cần hỗ trợ thêm?</p>
                <p className="mt-1 text-xs leading-relaxed text-[#86868b]">Liên hệ trực tiếp qua số <span className="font-semibold text-[#0071e3]">0775316675</span> hoặc Zalo cùng số này.</p>
              </div>
            </div>
            <a href="tel:0775316675"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0071e3] text-sm font-medium text-white hover:bg-[#0077ED]">
              Gọi ngay hỗ trợ
            </a>
          </div>
        </div>
      )}
    </main>
  );
};

export default Index;
