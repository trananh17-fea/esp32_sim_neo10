import { GOOGLE_SHEET_WEBHOOK_URL, LEAD_FORM_DEMO_MODE, LOCAL_LEAD_ENDPOINT } from "@/config/env";
import { trackApiRequest } from "@/services/analytics/webAnalytics";
import type { LeadFormData, LeadPayload } from "@/types/tracker";

export function validateLeadForm(data: LeadFormData): string | null {
  if (!data.name.trim()) return "Vui lòng nhập họ tên";
  if (!data.phone.trim()) return "Vui lòng nhập số điện thoại";

  const cleanPhone = data.phone.replace(/\s/g, "");
  if (!/^[0-9+-]{8,15}$/.test(cleanPhone)) return "Số điện thoại không hợp lệ";
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Email không hợp lệ";
  if (!data.interest) return "Vui lòng chọn nhu cầu";
  if (!data.product.trim()) return "Thiếu tên sản phẩm";
  if (!Number.isFinite(data.quantity) || data.quantity < 1 || data.quantity > 100) {
    return "Số lượng không hợp lệ";
  }

  return null;
}

export function normalizeLeadPayload(data: LeadFormData): LeadPayload {
  return {
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    interest: data.interest,
    quantity: Math.max(1, Math.min(100, Math.round(data.quantity))),
    product: data.product.trim(),
    message: data.message.trim(),
    source: "ba-sew-website",
    createdAt: new Date().toISOString(),
  };
}

async function submitToGoogleSheet(payload: LeadPayload): Promise<void> {
  const start = performance.now();

  try {
    const res = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const duration = Math.round(performance.now() - start);
    trackApiRequest("google-sheet-webhook", "POST", duration, "success", res.status || 200);
  } catch (error: unknown) {
    const duration = Math.round(performance.now() - start);
    trackApiRequest("google-sheet-webhook", "POST", duration, "error");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      message === "Failed to fetch"
        ? "Không thể kết nối đến Google Sheet. Vui lòng thử lại."
        : `Gửi thất bại: ${message || "Lỗi không xác định"}`
    );
  }
}

async function submitToLocalEndpoint(payload: LeadPayload): Promise<void> {
  const start = performance.now();

  try {
    const res = await fetch(LOCAL_LEAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const duration = Math.round(performance.now() - start);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      trackApiRequest("local-lead-endpoint", "POST", duration, "error", res.status);
      throw new Error(text || `HTTP ${res.status}`);
    }

    trackApiRequest("local-lead-endpoint", "POST", duration, "success", res.status);
  } catch (error: unknown) {
    const duration = Math.round(performance.now() - start);
    trackApiRequest("local-lead-endpoint", "POST", duration, "error");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      message === "Failed to fetch"
        ? "Không thể lưu thông tin vào endpoint local. Vui lòng kiểm tra server."
        : `Gửi thất bại: ${message || "Lỗi không xác định"}`
    );
  }
}

export async function submitLeadForm(data: LeadFormData): Promise<void> {
  const err = validateLeadForm(data);
  if (err) throw new Error(err);

  const payload = normalizeLeadPayload(data);

  if (GOOGLE_SHEET_WEBHOOK_URL) {
    await submitToGoogleSheet(payload);
    return;
  }

  if (LOCAL_LEAD_ENDPOINT) {
    await submitToLocalEndpoint(payload);
    return;
  }

  if (LEAD_FORM_DEMO_MODE) {
    console.log("[LeadForm] Demo mode payload:", payload);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return;
  }

  throw new Error("Chưa cấu hình nơi nhận dữ liệu form.");
}
