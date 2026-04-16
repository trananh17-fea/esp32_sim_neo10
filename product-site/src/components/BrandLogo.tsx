import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { BrandLogoProps } from "@/types";
import logo from "@/assets/logo.png";

const BrandLogo: FC<BrandLogoProps> = ({ className, compact = false, showSubtitle = true }) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[#1d1d1f]">
        <img src={logo} alt="Logo BA.SEW" className="h-full w-full object-contain p-1 brightness-0 invert" />
      </span>
      <div className={cn("min-w-0", compact && "space-y-0")}>
        <p className="font-display text-[17px] font-semibold leading-none tracking-tight text-[#1d1d1f]">BA.SEW</p>
        {showSubtitle && (
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-[#86868b]">
            Smart Emergency Warning
          </p>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
