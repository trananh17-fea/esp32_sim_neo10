import { useState, type FC, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CreditCard,
  Globe,
  Loader2,
  MapPin,
  MapPinned,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useAddressSelector } from "@/hooks/useAddressSelector";
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
    note: "",
    payment: "cod",
  });
  const [detailAddress, setDetailAddress] = useState("");
  const {
    provinces,
    districts,
    wards,
    selected,
    loading: addrLoading,
    error: addrError,
    fullAddress,
    isValid: addressValid,
    selectProvince,
    selectDistrict,
    selectWard,
  } = useAddressSelector(detailAddress);

  const shipping = 0;
  const grandTotal = totalPrice + shipping;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const hasContact = form.name.trim() && form.phone.trim();
    if (!hasContact || !addressValid) {
      if (!form.name.trim()) document.getElementById("field-name")?.focus();
      else if (!form.phone.trim()) document.getElementById("field-phone")?.focus();
      else if (!detailAddress.trim()) document.getElementById("field-detail-address")?.focus();
      return;
    }
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
            className="inline-flex items-center gap-1.5 text-sm text-[#e8340a] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Tiếp tục mua hàng
          </button>
          <BrandLogo compact showSubtitle={false} />
          <div className="flex items-center gap-2 text-xs text-[#6e6e73]">
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
            <p className="mt-2 text-sm leading-relaxed text-[#6e6e73]">
              Cảm ơn bạn đã đặt mua BA.SEW. Chúng tôi sẽ liên hệ xác nhận đơn hàng trong thời gian sớm nhất.
            </p>
            <p className="mt-4 rounded-xl bg-[#f5f5f7] p-4 text-xs text-[#6e6e73]">
              Mã đơn hàng: <span className="font-bold text-[#1d1d1f]">BASEW-{Date.now().toString(36).toUpperCase()}</span>
            </p>
            <button type="button" onClick={handleBackToShop}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#e8340a] px-6 text-sm font-medium text-white hover:bg-[#c92d08]">
              Về trang chủ
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="container py-20 text-center">
          <div className="mx-auto max-w-md rounded-3xl bg-white p-10 shadow-sm">
            <h2 className="text-xl font-semibold text-[#1d1d1f]">Giỏ hàng trống</h2>
            <p className="mt-2 text-sm text-[#6e6e73]">Hãy thêm sản phẩm BA.SEW vào giỏ hàng.</p>
            <button type="button" onClick={handleBackToShop}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#e8340a] px-6 text-sm font-medium text-white hover:bg-[#c92d08]">
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
                {i > 0 && <div className={`h-px w-8 ${active ? "bg-[#e8340a]" : "bg-[#d2d2d7]"}`} />}
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-[#e8340a] text-white" : "bg-[#d2d2d7] text-[#6e6e73]"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`text-xs font-medium ${active ? "text-[#1d1d1f]" : "text-[#6e6e73]"}`}>{label}</span>
              </div>
            ))}
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left - Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Customer info */}
              <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e8340a]/10 text-[#e8340a]">
                    <User className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">Thông tin người nhận</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#6e6e73]">Họ và tên *</label>
                    <input id="field-name" name="name" type="text" required value={form.name} onChange={handleChange}
                      placeholder="Nhập họ và tên"
                      className="h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm text-[#1d1d1f] outline-none focus:border-[#e8340a] focus:ring-1 focus:ring-[#e8340a]/20" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#6e6e73]">Số điện thoại *</label>
                      <input id="field-phone" name="phone" type="tel" required value={form.phone} onChange={handleChange}
                        placeholder="Nhập số điện thoại"
                        className="h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm text-[#1d1d1f] outline-none focus:border-[#e8340a] focus:ring-1 focus:ring-[#e8340a]/20" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#6e6e73]">Email</label>
                      <input name="email" type="email" value={form.email} onChange={handleChange}
                        placeholder="Nhập email (không bắt buộc)"
                        className="h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm text-[#1d1d1f] outline-none focus:border-[#e8340a] focus:ring-1 focus:ring-[#e8340a]/20" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping address */}
              <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e8340a]/10 text-[#e8340a]">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">Địa chỉ giao hàng</h3>
                </div>

                {/* ── 3-level address cascade ── */}
                {addrError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                    {addrError}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Tỉnh / Thành phố */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#6e6e73]">
                      Tỉnh / Thành phố <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={selected.province?.code ?? ""}
                        onChange={(e) => {
                          const p = provinces.find((x) => x.code === Number(e.target.value)) ?? null;
                          selectProvince(p);
                        }}
                        disabled={addrLoading.provinces}
                        className="h-11 w-full appearance-none rounded-xl border border-[#d2d2d7] bg-white px-4 pr-9 text-sm text-[#1d1d1f] outline-none transition-all focus:border-[#e8340a] focus:ring-1 focus:ring-[#e8340a]/20 disabled:cursor-not-allowed disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                      >
                        <option value="">{addrLoading.provinces ? "Đang tải..." : "-- Chọn Tỉnh/TP --"}</option>
                        {provinces.map((p) => (
                          <option key={p.code} value={p.code}>{p.name}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#86868b]">
                        {addrLoading.provinces
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Quận / Huyện */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#6e6e73]">
                      Quận / Huyện <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={selected.district?.code ?? ""}
                        onChange={(e) => {
                          const d = districts.find((x) => x.code === Number(e.target.value)) ?? null;
                          selectDistrict(d);
                        }}
                        disabled={!selected.province || addrLoading.districts}
                        className="h-11 w-full appearance-none rounded-xl border border-[#d2d2d7] bg-white px-4 pr-9 text-sm text-[#1d1d1f] outline-none transition-all focus:border-[#e8340a] focus:ring-1 focus:ring-[#e8340a]/20 disabled:cursor-not-allowed disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                      >
                        <option value="">
                          {!selected.province
                            ? "-- Chọn Quận/Huyện --"
                            : addrLoading.districts
                              ? "Đang tải..."
                              : "-- Chọn Quận/Huyện --"}
                        </option>
                        {districts.map((d) => (
                          <option key={d.code} value={d.code}>{d.name}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#86868b]">
                        {addrLoading.districts
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Phường / Xã */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#6e6e73]">
                      Phường / Xã <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={selected.ward?.code ?? ""}
                        onChange={(e) => {
                          const w = wards.find((x) => x.code === Number(e.target.value)) ?? null;
                          selectWard(w);
                        }}
                        disabled={!selected.district || addrLoading.wards}
                        className="h-11 w-full appearance-none rounded-xl border border-[#d2d2d7] bg-white px-4 pr-9 text-sm text-[#1d1d1f] outline-none transition-all focus:border-[#e8340a] focus:ring-1 focus:ring-[#e8340a]/20 disabled:cursor-not-allowed disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                      >
                        <option value="">
                          {!selected.district
                            ? "-- Chọn Phường/Xã --"
                            : addrLoading.wards
                              ? "Đang tải..."
                              : "-- Chọn Phường/Xã --"}
                        </option>
                        {wards.map((w) => (
                          <option key={w.code} value={w.code}>{w.name}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#86868b]">
                        {addrLoading.wards
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Địa chỉ chi tiết */}
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-medium text-[#6e6e73]">
                    Địa chỉ chi tiết <span className="text-red-400">*</span>
                    <span className="ml-1 font-normal text-[#86868b]">(Số nhà, tên đường, tầng...)</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#86868b]">
                      <Globe className="h-4 w-4" />
                    </span>
                    <input
                      id="field-detail-address"
                      type="text"
                      value={detailAddress}
                      onChange={(e) => setDetailAddress(e.target.value)}
                      placeholder="VD: 123 Nguyễn Huệ, P. Bến Nghé, Tầng 3..."
                      className="h-11 w-full rounded-xl border border-[#d2d2d7] bg-white pl-10 pr-4 text-sm text-[#1d1d1f] outline-none transition-all placeholder:text-[#86868b] focus:border-[#e8340a] focus:ring-1 focus:ring-[#e8340a]/20"
                    />
                  </div>
                </div>

                {/* Full address preview */}
                {fullAddress && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#e8340a]/20 bg-[#fff1ee] p-3">
                    <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-[#e8340a]" />
                    <div>
                      <p className="text-xs font-semibold text-[#e8340a]">Địa chỉ giao hàng</p>
                      <p className="mt-0.5 text-sm text-[#1d1d1f]">{fullAddress}</p>
                    </div>
                  </div>
                )}

                {/* Ghi chú giao hàng */}
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-medium text-[#6e6e73]">Ghi chú giao hàng</label>
                  <textarea name="note" value={form.note} onChange={handleChange} rows={2}
                    placeholder="VD: Giao giờ hành chính, gọi trước khi giao..."
                    className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none focus:border-[#e8340a] focus:ring-1 focus:ring-[#e8340a]/20" />
                </div>
              </div>

              {/* Payment method */}
              <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e8340a]/10 text-[#e8340a]">
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
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${form.payment === value ? "border-[#e8340a] bg-[#e8340a]/5" : "border-[#d2d2d7] hover:bg-[#f5f5f7]"}`}>
                      <input type="radio" name="payment" value={value}
                        checked={form.payment === value} onChange={handleChange}
                        className="mt-0.5 h-4 w-4 accent-[#e8340a]" />
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#6e6e73]" />
                      <div>
                        <span className="text-sm font-medium text-[#1d1d1f]">{label}</span>
                        <p className="mt-0.5 text-xs text-[#6e6e73]">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {form.payment === "bank" && (
                  <div className="mt-4 rounded-xl bg-[#f5f5f7] p-4">
                    <p className="text-xs font-semibold text-[#1d1d1f]">Thông tin chuyển khoản:</p>
                    <div className="mt-2 space-y-1 text-xs text-[#6e6e73]">
                      <p>Ngân hàng: <span className="font-medium text-[#1d1d1f]">Vietcombank</span></p>
                      <p>STK: <span className="font-medium text-[#1d1d1f]">1234567890</span></p>
                      <p>Chủ TK: <span className="font-medium text-[#1d1d1f]">NGUYEN VAN A</span></p>
                      <p>Nội dung: <span className="font-medium text-[#e8340a]">BASEW [SĐT]</span></p>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit - mobile */}
              <button type="submit" disabled={status === "sending"}
                className="h-12 w-full rounded-full bg-[#e8340a] text-[15px] font-medium text-white transition-all hover:bg-[#c92d08] disabled:opacity-60 lg:hidden">
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
                            style={{ backgroundColor: item.color === "Trắng" ? "#f0f0f0" : item.color === "Đen" ? "#1d1d1f" : "#e8340a" }} />
                          <span className="text-xs text-[#6e6e73]">{item.color}</span>
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
                            className="text-[#6e6e73] hover:text-red-500">
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
                  <span className="text-[#6e6e73]">Tạm tính</span>
                  <span className="text-[#1d1d1f]">{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6e6e73]">Phí vận chuyển</span>
                  <span className="font-medium text-green-600">Miễn phí</span>
                </div>
                <div className="flex justify-between border-t border-[#f5f5f7] pt-3 text-base">
                  <span className="font-semibold text-[#1d1d1f]">Tổng cộng</span>
                  <span className="text-lg font-bold text-[#1d1d1f]">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Submit - desktop */}
              <button type="button" disabled={status === "sending"}
                onClick={() => {
                  const formEl = document.querySelector("form") as HTMLFormElement;
                  formEl?.requestSubmit();
                }}
                className="mt-6 hidden h-12 w-full rounded-full bg-[#e8340a] text-[15px] font-medium text-white transition-all hover:bg-[#c92d08] disabled:opacity-60 lg:inline-flex lg:items-center lg:justify-center">
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
