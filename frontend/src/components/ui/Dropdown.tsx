import { type SelectHTMLAttributes } from "react";

type Option = {
  value: string;
  label: string;
};

export function Dropdown({
  label,
  options,
  error,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Option[];
  error?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      <select
        {...props}
        className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500 ${
          error ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
        } ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="block mt-1 text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
