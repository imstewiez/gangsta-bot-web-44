import { cn } from "@/lib/utils";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
}

export function FadeIn({ children, className, delay = "0ms", direction = "up" }: FadeInProps) {
  const dirClass =
    direction === "up"
      ? "animate-in fade-in slide-in-from-bottom-2"
      : direction === "down"
      ? "animate-in fade-in slide-in-from-top-2"
      : direction === "left"
      ? "animate-in fade-in slide-in-from-right-2"
      : direction === "right"
      ? "animate-in fade-in slide-in-from-left-2"
      : "animate-in fade-in";

  return (
    <div
      className={cn("duration-500 fill-mode-forwards", dirClass, className)}
      style={{ animationDelay: delay, animationDuration: "500ms" }}
    >
      {children}
    </div>
  );
}
