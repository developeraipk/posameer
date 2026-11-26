import React, { forwardRef } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={twMerge(
              clsx(
                "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors shadow-xs",
                "focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-900/50",
                icon ? "pl-10 pr-3" : "px-3.5",
                error && "border-rose-500 focus:ring-rose-500/30 focus:border-rose-500",
                className
              )
            )}
            {...props}
            onWheel={(e) => {
              if (props.type === "number") {
                e.currentTarget.blur();
              }
              props.onWheel?.(e);
            }}
          />
        </div>
        {error && <p className="text-[11px] text-rose-500 dark:text-rose-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
