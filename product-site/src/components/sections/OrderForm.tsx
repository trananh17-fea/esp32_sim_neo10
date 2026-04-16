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
  "h-11 w-full rounded-xl border border-[#D8CCBD] bg-[#FFFDFC] px-3 text-sm text-[#2B211B] outline-none transition-all placeholder:text-[#9D8A7A] focus:border-[#6B4F3A] focus:ring-2 focus:ring-[#6B4F3A]/20";

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
    <div className={cn("rounded-2xl border border-[#E7DED2] bg-white p-5 sm:p-6", className)}>
      <h3 className="text-xl font-bold tracking-tight text-[#2B211B]">{t.order.heading}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[#6E5A4A]">{t.order.sub}</p>

      {status === "success" ? (
        <div className="py-10 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#6B4F3A]/10 text-[#6B4F3A]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="mx-auto max-w-md text-sm font-medium leading-relaxed text-[#2B211B]">{t.order.success}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} onFocus={markFormStarted} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#4A3426]">{t.order.name} *</label>
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
            {errors.name && <p className="mt-1 text-xs text-[#AF3E32]">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#4A3426]">{t.order.phone} *</label>
              <input
                {...register("phone")}
                placeholder={t.order.placeholders.phone}
                autoComplete="tel"
                inputMode="tel"
                aria-invalid={Boolean(errors.phone)}
                className={fieldClassName}
              />
              {errors.phone && <p className="mt-1 text-xs text-[#AF3E32]">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#4A3426]">{t.order.quantity} *</label>
              <input
                {...register("quantity")}
                type="number"
                min={1}
                max={100}
                placeholder={t.order.placeholders.quantity}
                aria-invalid={Boolean(errors.quantity)}
                className={fieldClassName}
              />
              {errors.quantity && <p className="mt-1 text-xs text-[#AF3E32]">{errors.quantity.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#4A3426]">{t.order.email}</label>
            <input
              {...register("email")}
              type="email"
              placeholder={t.order.placeholders.email}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              className={fieldClassName}
            />
            {errors.email && <p className="mt-1 text-xs text-[#AF3E32]">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#4A3426]">{t.order.interest} *</label>
            <select {...register("interest")} aria-invalid={Boolean(errors.interest)} className={fieldClassName}>
              <option value="">{t.order.placeholders.interest}</option>
              {interests.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.interest && <p className="mt-1 text-xs text-[#AF3E32]">{errors.interest.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#4A3426]">{t.order.message}</label>
            <textarea
              {...register("message")}
              rows={4}
              placeholder={t.order.placeholders.message}
              className="w-full rounded-xl border border-[#D8CCBD] bg-[#FFFDFC] px-3 py-2.5 text-sm text-[#2B211B] outline-none transition-all placeholder:text-[#9D8A7A] focus:border-[#6B4F3A] focus:ring-2 focus:ring-[#6B4F3A]/20"
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6B4F3A] text-sm font-semibold text-white transition-colors hover:bg-[#4A3426] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === "sending" ? t.order.sending : t.order.submit}
          </button>

          {status === "error" && (
            <div className="flex items-center gap-2 rounded-xl border border-[#F5C2BD] bg-[#FFF4F3] px-3 py-2 text-sm text-[#AF3E32]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{t.order.error}</p>
            </div>
          )}

          <p className="text-center text-xs text-[#7C6958]">{t.order.privacy}</p>
        </form>
      )}
    </div>
  );
};

export default OrderForm;
