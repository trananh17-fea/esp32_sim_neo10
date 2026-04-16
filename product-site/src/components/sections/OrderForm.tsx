import React, { useRef, useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useAnchorFocus } from "@/hooks/useAnchorFocus";
import { submitLeadForm } from "@/services/forms/leadForm";
import {
  trackOrderFormError,
  trackOrderFormStart,
  trackOrderFormSubmit,
  trackOrderFormSuccess,
} from "@/services/analytics/webAnalytics";
import { cn } from "@/lib/utils";
import type { OrderFormProps, OrderFormStatus } from "@/types";

const PRODUCT_NAME: string = "BA.SEW";

const schema = z.object({
  name: z.string().min(1, "Vui lòng nhập họ và tên").max(100),
  phone: z
    .string()
    .min(1, "Vui lòng nhập số điện thoại")
    .regex(/^[0-9+\s-]{8,15}$/, "Số điện thoại không hợp lệ"),
  email: z.string().email("Email không hợp lệ").or(z.literal("")).optional(),
  interest: z.string().min(1, "Vui lòng chọn nhu cầu"),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Số lượng tối thiểu là 1")
    .max(100, "Số lượng tối đa là 100"),
  message: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof schema>;

const fieldClassName: string =
  "h-12 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-[15px] text-[#1d1d1f] outline-none transition-all placeholder:text-[#86868b] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20";

const OrderForm: FC<OrderFormProps> = ({ className }) => {
  const { t } = useI18n();
  const [status, setStatus] = useState<OrderFormStatus>("idle");
  const startedRef = useRef<boolean>(false);
  const anchorRef = useAnchorFocus<HTMLInputElement>("#order");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", interest: "", quantity: 1, message: "" },
  });

  const markFormStarted = (): void => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackOrderFormStart("order");
  };

  const onSubmit = async (data: FormData): Promise<void> => {
    setStatus("sending");
    trackOrderFormSubmit("order");

    try {
      await submitLeadForm({
        name: data.name,
        phone: data.phone,
        email: data.email || "",
        interest: data.interest,
        quantity: data.quantity,
        product: PRODUCT_NAME,
        message: data.message || "",
      });

      setStatus("success");
      trackOrderFormSuccess("order");
      reset({ name: "", phone: "", email: "", interest: "", quantity: 1, message: "" });
      startedRef.current = false;
      setTimeout(() => setStatus("idle"), 6000);
    } catch {
      setStatus("error");
      trackOrderFormError("order");
      setTimeout(() => setStatus("idle"), 6000);
    }
  };

  interface InterestOption {
    value: string;
    label: string;
  }

  const interests: InterestOption[] = [
    { value: "buy", label: t.order.interests.buy },
    { value: "family", label: t.order.interests.family },
    { value: "school", label: t.order.interests.school },
    { value: "consult", label: t.order.interests.consult },
  ];
  const nameField = register("name");

  return (
    <div className={cn("rounded-3xl bg-white p-6 sm:p-8", className)}>
      <h3 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">{t.order.heading}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[#86868b]">{t.order.sub}</p>

      {status === "success" ? (
        <div className="py-12 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f5e9] text-[#34c759]">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <p className="mx-auto max-w-md text-sm font-medium leading-relaxed text-[#1d1d1f]">{t.order.success}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} onFocus={markFormStarted} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">{t.order.name} *</label>
            <input
              {...nameField}
              ref={(el) => {
                nameField.ref(el);
                (anchorRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
              }}
              placeholder={t.order.placeholders.name}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              className={fieldClassName}
            />
            {errors.name && <p className="mt-1 text-xs text-[#ff3b30]">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">{t.order.phone} *</label>
              <input
                {...register("phone")}
                placeholder={t.order.placeholders.phone}
                autoComplete="tel"
                inputMode="tel"
                aria-invalid={Boolean(errors.phone)}
                className={fieldClassName}
              />
              {errors.phone && <p className="mt-1 text-xs text-[#ff3b30]">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">{t.order.quantity} *</label>
              <input
                {...register("quantity")}
                type="number"
                min={1}
                max={100}
                placeholder={t.order.placeholders.quantity}
                aria-invalid={Boolean(errors.quantity)}
                className={fieldClassName}
              />
              {errors.quantity && <p className="mt-1 text-xs text-[#ff3b30]">{errors.quantity.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">{t.order.email}</label>
            <input
              {...register("email")}
              type="email"
              placeholder={t.order.placeholders.email}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              className={fieldClassName}
            />
            {errors.email && <p className="mt-1 text-xs text-[#ff3b30]">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">{t.order.interest} *</label>
            <select {...register("interest")} aria-invalid={Boolean(errors.interest)} className={fieldClassName}>
              <option value="">{t.order.placeholders.interest}</option>
              {interests.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.interest && <p className="mt-1 text-xs text-[#ff3b30]">{errors.interest.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">{t.order.message}</label>
            <textarea
              {...register("message")}
              rows={4}
              placeholder={t.order.placeholders.message}
              className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none transition-all placeholder:text-[#86868b] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] text-[15px] font-normal text-white transition-colors hover:bg-[#0077ED] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === "sending" ? t.order.sending : t.order.submit}
          </button>

          {status === "error" && (
            <div className="flex items-center gap-2 rounded-xl bg-[#fff5f5] px-4 py-3 text-sm text-[#ff3b30]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{t.order.error}</p>
            </div>
          )}

          <p className="text-center text-xs text-[#86868b]">{t.order.privacy}</p>
        </form>
      )}
    </div>
  );
};

export default OrderForm;
