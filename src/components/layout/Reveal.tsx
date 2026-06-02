import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
  duration?: number;
  once?: boolean;
  threshold?: number;
}

export function Reveal({
  children,
  className,
  delay = 0,
  duration = 420,
}: RevealProps) {
  return (
    <div
      className={cn("animate-rise", className)}
      style={{
        opacity: 1,
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}

interface StaggerProps {
  children: React.ReactNode[];
  className?: string;
  childClassName?: string;
  staggerDelay?: number;
  baseDelay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
  threshold?: number;
}

export function Stagger({
  children,
  className,
  childClassName,
  staggerDelay = 70,
  baseDelay = 0,
}: StaggerProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal
          key={i}
          delay={baseDelay + i * staggerDelay}
          className={childClassName}
        >
          {child}
        </Reveal>
      ))}
    </div>
  );
}
