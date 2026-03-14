import { type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type CommonProps = {
  label: string;
  error?: string;
  hint?: string;
};

export function FormInput({
  label,
  error,
  hint,
  className = "",
  ...props
}: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      <input
        {...props}
        className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500 ${
          error ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
        } ${className}`}
      />
      {hint ? <span className="block mt-1 text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="block mt-1 text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

export function FormTextArea({
  label,
  error,
  hint,
  className = "",
  ...props
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      <textarea
        {...props}
        className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500 resize-none ${
          error ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
        } ${className}`}
      />
      {hint ? <span className="block mt-1 text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="block mt-1 text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
