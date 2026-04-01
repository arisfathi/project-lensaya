import { type HTMLAttributes } from "react";

interface BrandWordmarkProps extends HTMLAttributes<HTMLSpanElement> {
  suffix?: string;
  suffixClassName?: string;
  showIcon?: boolean;
  showText?: boolean;
  iconClassName?: string;
  textClassName?: string;
}

export function BrandWordmark({
  suffix,
  suffixClassName = "",
  showIcon = true,
  showText = true,
  iconClassName = "",
  textClassName = "",
  className = "",
  ...props
}: BrandWordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()} {...props}>
      {showIcon ? (
        <img
          src="/lensaya-master-icon-1024.svg"
          alt="Lensaya"
          className={`h-8 w-8 object-contain ${iconClassName}`.trim()}
        />
      ) : null}
      {showText ? (
        <span className="flex items-baseline gap-1">
          <span className={`brand-wordmark text-inherit ${textClassName}`.trim()}>Lensaya</span>
          {suffix ? <span className={`font-medium ${suffixClassName}`.trim()}>{suffix}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
