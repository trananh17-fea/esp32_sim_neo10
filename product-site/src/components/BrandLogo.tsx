import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { BrandLogoProps } from "@/types";
import logo from "@/assets/logo.png";

const BrandLogo: FC<BrandLogoProps> = ({ className, compact = false, showSubtitle = true }) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-white shadow-[0_10px_28px_-20px_rgba(74,52,38,0.9)]">
        <img src={logo} alt="Logo BA.SEW" className="h-full w-full object-contain p-1" />
      </span>
      <div className={cn("min-w-0", compact && "space-y-0")}>
        <p className="font-display text-lg leading-none tracking-tight text-foreground">BA.SEW</p>
        {showSubtitle && (
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Smart Emergency Warning
          </p>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
