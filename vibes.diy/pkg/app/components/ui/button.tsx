import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils.js";

const baseClasses =
  "inline-flex items-center justify-center whitespace-nowrap rounded-[--radius-base] text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2 border-borde inline-flex items-center justify-center whitespace-nowrap rounded-[5px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2 border-black";
const shadowClasses = "shadow-[4px_4px_0px_0px_black]";
const activeClasses =
  "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none";

const buttonVariants = cva(`${baseClasses} ${shadowClasses} ${activeClasses}`, {
  variants: {
    variant: {
      blue: "bg-blue-500 text-white hover:bg-blue-600",
      electric: "bg-yellow-300 text-black hover:bg-yellow-400",
      hot: "bg-pink-400 text-white hover:bg-pink-500",
      cyber: "bg-lime-400 text-white hover:bg-lime-500",
      retro: "bg-orange-400 text-white hover:bg-orange-500",
      cool: "bg-cyan-400 text-white hover:bg-cyan-500",
      dream: "bg-violet-400 text-white hover:bg-violet-500",
      danger: "bg-red-400 text-white hover:bg-red-500",
    },
    size: {
      default: "h-10 w-10 sm:w-auto sm:px-4 sm:gap-2",
      fixed: "h-10 px-4 gap-2",
    },
  },
  defaultVariants: {
    variant: "blue",
    size: "default",
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
