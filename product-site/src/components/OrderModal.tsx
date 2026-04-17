import { useState, type FC } from "react";
import { Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import productImg1 from "@/assets/img1.jpg";
import productImg2 from "@/assets/img2.jpg";
import productImg3 from "@/assets/img3.jpg";

const PRODUCT_COLORS = [
  { name: "Đen", value: "#1d1d1f", image: productImg1 },
  { name: "Trắng", value: "#f0f0f0", image: productImg2 },
  { name: "Xanh", value: "#e8340a", image: productImg3 },
];

const PRODUCT = {
  id: "basew-device",
  name: "BA.SEW — Thiết bị cảnh báo khẩn cấp",
  price: 400000,
};

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OrderModal: FC<OrderModalProps> = ({ isOpen, onClose }) => {
  const { addItem, toggleCart } = useCart();
  const [selectedColor, setSelectedColor] = useState(PRODUCT_COLORS[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addItem({ ...PRODUCT, image: selectedColor.image, color: selectedColor.name }, qty);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
      toggleCart();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl animate-[slideDown_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f5f5f7] px-6 py-4">
          <h3 className="text-base font-semibold text-[#1d1d1f]">Chọn sản phẩm</h3>
          <button type="button" onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#86868b] hover:bg-[#f5f5f7]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Product image */}
          <div className="overflow-hidden rounded-2xl bg-[#f5f5f7]">
            <img
              src={selectedColor.image}
              alt={`BA.SEW — ${selectedColor.name}`}
              className="mx-auto h-48 w-full object-contain"
            />
          </div>

          {/* Name + price */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1d1d1f]">{PRODUCT.name}</p>
            <p className="text-sm font-bold text-[#e8340a]">
              {PRODUCT.price.toLocaleString("vi-VN")}đ
            </p>
          </div>

          {/* Color picker */}
          <div className="mt-4">
            <p className="mb-2 text-xs text-[#86868b]">
              Màu sắc: <span className="font-medium text-[#1d1d1f]">{selectedColor.name}</span>
            </p>
            <div className="flex gap-3">
              {PRODUCT_COLORS.map((color) => (
                <button key={color.name} type="button" onClick={() => setSelectedColor(color)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${selectedColor.name === color.name
                      ? "border-[#e8340a] ring-2 ring-[#e8340a]/20"
                      : "border-[#d2d2d7] hover:border-[#86868b]"
                    }`}>
                  <span className="h-5 w-5 rounded-full" style={{ backgroundColor: color.value }} />
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="mt-4">
            <p className="mb-2 text-xs text-[#86868b]">Số lượng</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed]">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-base font-semibold text-[#1d1d1f]">{qty}</span>
              <button type="button" onClick={() => setQty((q) => q + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed]">
                <Plus className="h-4 w-4" />
              </button>
              <span className="ml-auto text-sm font-bold text-[#1d1d1f]">
                {(PRODUCT.price * qty).toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>

          {/* Add to cart */}
          <button type="button" onClick={handleAddToCart}
            className={`mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium text-white transition-all ${added ? "bg-green-500" : "bg-[#e8340a] hover:bg-[#c92d08]"
              }`}>
            {added
              ? <><Check className="h-5 w-5" />Đã thêm vào giỏ!</>
              : <><ShoppingBag className="h-5 w-5" />Thêm vào giỏ hàng</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderModal;