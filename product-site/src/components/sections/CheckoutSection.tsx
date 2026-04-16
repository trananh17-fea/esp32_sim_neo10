import { useState, type FC, type FormEvent } from "react";
import { ArrowLeft, Check, CreditCard, MapPin, Minus, Plus, ShieldCheck, Trash2, Truck, User } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import BrandLogo from "@/components/BrandLogo";

type CheckoutStatus = "idle" | "sending" | "success" | "error";

function formatPrice(price: number): string {
  return price.toLocaleString("vi-VN") + "đ";
}

interface CheckoutSectionProps {
  isOpen: boolean;
  onClose: () => void;
}

const CheckoutSection: FC<CheckoutSectionProps> = ({ isOpen, onClose }) => {
  const { items, totalItems, totalPrice, removeItem, updateQuantity, clearCart } = useCart();
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    note: "",
    payment: "cod",
  });

  const shipping = 0;
  const grandTotal = totalPrice + shipping;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) return;
    setStatus("sending");
    setTimeout(() => {
      setStatus("success");
      clearCart();
    }, 1500);
  };

  const handleBackToShop = () => {
    setStatus("idle");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f5f5f7]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-[#d2d2d7]/40 bg-white/80 backdrop-blur-2xl">
        <div className="container flex h-12 items-center justify-between">
          <button type="button" onClick={handleBackToShop}
            className="inline-flex items-center gap-1.5 text-sm text-[#0071e3] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Tiếp tục mua hàng
          </button>
          <BrandLogo compact showSubtitle={false} />
          <div className="flex items-center gap-2 text-xs text-[#86868b]">
            <ShieldCheck className="h-4 w-4" />
            Thanh toán an toàn
          </div>
        </div>
      </div>

      {/* Success */}
      {status === "success" ? (
        <div className="container py-20 text-center">
          <div className="mx-auto max-w-md rounded-3xl bg-white p-10 shadow-sm">
            <span className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-500">
              <Check className="h-8 w-8" />
            </span>
            <h2 className="text-xl font-semibold text-[#1d1d1f]">Đặt hàng thành công!</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#86868b]">
              Cảm ơn bạn đã đặt mua BA.SEW. Chúng tôi sẽ liên hệ xác nhận đơn hàng trong thời gian sớm nhất.
            </p>
            <p className="mt-4 rounded-xl bg-[#f5f5f7] p-4 text-xs text-[#86868b]">
              Mã đơn hàng: <span className="font-bold text-[#1d1d1f]">BASEW-{Date.now().toString(36).toUpperCase()}</span>
            </p>
            <button type="button" onClick={handleBackToShop}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#0071e3] px-6 text-sm font-medium text-white hover:bg-[#0077ED]">
              Về trang chủ
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="container py-20 text-center">
          <div className="mx-auto max-w-md rounded-3xl bg-white p-10 shadow-sm">
            <h2 className="text-xl font-semibold text-[#1d1d1f]">Giỏ hàng trống</h2>
            <p className="mt-2 text-sm text-[#86868b]">Hãy thêm sản phẩm BA.SEW vào giỏ hàng.</p>
            <button type="button" onClick={handleBackToShop}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#0071e3] px-6 text-sm font-medium text-white hover:bg-[#0077ED]">
              <ArrowLeft className="h-4 w-4" />
              Quay lại mua hàng
            </button>
          </div>
        </div>
      ) : (
        <div className="container py-8">
          {/* Checkout steps */}
          <div className="mb-8 flex items-center justify-center gap-8">
            {[
              { icon: MapPin, label: "Giao hàng", active: true },
              { icon: CreditCard, label: "Thanh toán", active: true },
              { icon: Check, label: "Xác nhận", active: false },
            ].map(({ icon: Icon, label, active }, i) => (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <div className={`h-px w-8 ${active ? "bg-[#0071e3]" : "bg-[#d2d2d7]"}`} />}
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-[#0071e3] text-white" : "bg-[#d2d2d7] text-[#86868b]"
                  }`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`text-xs font-medium ${active ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>{label}</span>
              </div>
            ))}

          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left - Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Customer info */}
              <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0071e3]/10 text-[#0071e3]">
                    <User className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">Thông tin người nhận</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#86868b]">Họ và tên *</label>
                    <input name="name" type="text" required value={form.name} onChange={handleChange}
                      placeholder="Nhập họ và tên"
                      className="h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3]" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#86868b]">Số điện thoại *</label>
                      <input name="phone" type="tel" required value={form.phone} onChange={handleChange}
                        placeholder="Nhập số điện thoại"
                        className="h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#86868b]">Email</label>
                      <input name="email" type="email" value={form.email} onChange={handleChange}
                        placeholder="Nhập email (không bắt buộc)"
                        className="h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping address */}
              <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0071e3]/10 text-[#0071e3]">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">Địa chỉ giao hàng</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#86868b]">Địa chỉ *</label>
                    <input name="address" type="text" required value={form.address} onChange={handleChange}
                      placeholder="Số nhà, đường, phường/xã, quận/huyện"
                      className="h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#86868b]">Tỉnh / Thành phố *</label>
                    <input name="city" type="text" required value={form.city} onChange={handleChange}
                      placeholder="VD: TP. Hồ Chí Minh"
                      className="h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#86868b]">Ghi chú giao hàng</label>
                    <textarea name="note" value={form.note} onChange={handleChange} rows={2}
                      placeholder="VD: Giao giờ hành chính, gọi trước khi giao..."
                      className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3]" />
                  </div>
                </div>
              </div>

              {/* Payment method */}
              <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0071e3]/10 text-[#0071e3]">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">Phương thức thanh toán</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { value: "cod", label: "Thanh toán khi nhận hàng (COD)", desc: "Trả tiền mặt khi nhận hàng", icon: Truck },
                    { value: "bank", label: "Chuyển khoản ngân hàng", desc: "Chuyển khoản trước, giao hàng sau", icon: ShieldCheck },
                  ].map(({ value, label, desc, icon: Icon }) => (
                    <label key={value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${form.payment === value ? "border-[#0071e3] bg-[#0071e3]/5" : "border-[#d2d2d7] hover:bg-[#f5f5f7]"
                        }`}>
                      <input type="radio" name="payment" value={value}
                        checked={form.payment === value} onChange={handleChange}
                        className="mt-0.5 h-4 w-4 accent-[#0071e3]" />
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#86868b]" />
                      <div>
                        <span className="text-sm font-medium text-[#1d1d1f]">{label}</span>
                        <p className="mt-0.5 text-xs text-[#86868b]">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {form.payment === "bank" && (
                  <div className="mt-4 rounded-xl bg-[#f5f5f7] p-4">
                    <p className="text-xs font-semibold text-[#1d1d1f]">Thông tin chuyển khoản:</p>
                    <div className="mt-2 space-y-1 text-xs text-[#86868b]">
                      <p>Ngân hàng: <span className="font-medium text-[#1d1d1f]">Vietcombank</span></p>
                      <p>STK: <span className="font-medium text-[#1d1d1f]">1234567890</span></p>
                      <p>Chủ TK: <span className="font-medium text-[#1d1d1f]">NGUYEN VAN A</span></p>
                      <p>Nội dung: <span className="font-medium text-[#0071e3]">BASEW [SĐT]</span></p>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit - mobile */}
              <button type="submit" disabled={status === "sending"}
                className="h-12 w-full rounded-full bg-[#0071e3] text-[15px] font-medium text-white transition-all hover:bg-[#0077ED] disabled:opacity-60 lg:hidden">
                {status === "sending" ? "Đang xử lý..." : `Đặt hàng — ${formatPrice(grandTotal)}`}
              </button>
            </form>

            {/* Right - Order summary */}
            <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8 lg:sticky lg:top-20">
              <h3 className="mb-5 text-base font-semibold text-[#1d1d1f]">
                Đơn hàng ({totalItems} sản phẩm)
              </h3>

              <div className="divide-y divide-[#f5f5f7]">
                {items.map((item) => (
                  <div key={`${item.id}-${item.color}`} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f5f5f7]">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1d1d1f] text-[10px] font-bold text-white">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#1d1d1f] line-clamp-1">{item.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-block h-3.5 w-3.5 rounded-full border border-[#d2d2d7]"
                            style={{ backgroundColor: item.color === "Trắng" ? "#f0f0f0" : item.color === "Đen" ? "#1d1d1f" : "#0071e3" }} />
                          <span className="text-xs text-[#86868b]">{item.color}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => updateQuantity(item.id, item.color, item.quantity - 1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed]">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-medium">{item.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(item.id, item.color, item.quantity + 1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed]">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1d1d1f]">{formatPrice(item.price * item.quantity)}</span>
                          <button type="button" onClick={() => removeItem(item.id, item.color)}
                            className="text-[#86868b] hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-5 space-y-2 border-t border-[#f5f5f7] pt-5">
                <div className="flex justify-between text-sm">
                  <span className="text-[#86868b]">Tạm tính</span>
                  <span className="text-[#1d1d1f]">{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#86868b]">Phí vận chuyển</span>
                  <span className="font-medium text-green-600">Miễn phí</span>
                </div>
                <div className="flex justify-between border-t border-[#f5f5f7] pt-3 text-base">
                  <span className="font-semibold text-[#1d1d1f]">Tổng cộng</span>
                  <span className="text-lg font-bold text-[#1d1d1f]">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Submit - desktop */}
              <button type="submit" form="" disabled={status === "sending"}
                onClick={() => {
                  const form = document.querySelector("form") as HTMLFormElement;
                  form?.requestSubmit();
                }}
                className="mt-6 hidden h-12 w-full rounded-full bg-[#0071e3] text-[15px] font-medium text-white transition-all hover:bg-[#0077ED] disabled:opacity-60 lg:inline-flex lg:items-center lg:justify-center">
                {status === "sending" ? "Đang xử lý..." : `Đặt hàng — ${formatPrice(grandTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutSection;