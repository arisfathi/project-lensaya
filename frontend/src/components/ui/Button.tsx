import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-cyan-500 text-white hover:bg-cyan-600 border border-cyan-500",
  secondary: "bg-white text-slate-700 hover:bg-slate-50 border border-slate-300",
  danger: "bg-red-500 text-white hover:bg-red-600 border border-red-500",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent",
};

export function Button({
  variant = "primary",
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
    />
  );
}
