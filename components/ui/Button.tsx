import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-xl px-6 py-3 font-bold transition-all duration-300 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
          variant === "default" && "bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 hover:shadow-blue-500/30",
          variant === "outline" && "border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10",
          variant === "ghost" && "hover:bg-white/5",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
