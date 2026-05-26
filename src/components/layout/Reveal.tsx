import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

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
  direction = "up",
  duration = 600,
  once = true,
  threshold = 0.15,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once, threshold]);

  const initialStyles: React.CSSProperties = {
    opacity: 0,
    transform:
      direction === "up"
        ? "translateY(24px)"
        : direction === "down"
        ? "translateY(-24px)"
        : direction === "left"
        ? "translateX(24px)"
        : direction === "right"
        ? "translateX(-24px)"
        : direction === "scale"
        ? "scale(0.96)"
        : "translateY(24px)",
    transition: `opacity ${duration}ms cubic-bezier(0.2, 0.7, 0.2, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.2, 0.7, 0.2, 1) ${delay}ms`,
    willChange: "opacity, transform",
  };

  const activeStyles: React.CSSProperties = {
    opacity: 1,
    transform: "translateY(0) translateX(0) scale(1)",
  };

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={visible ? { ...initialStyles, ...activeStyles } : initialStyles}
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
  staggerDelay = 80,
  baseDelay = 0,
  direction = "up",
  threshold = 0.1,
}: StaggerProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal
          key={i}
          delay={baseDelay + i * staggerDelay}
          direction={direction}
          threshold={threshold}
          className={childClassName}
        >
          {child}
        </Reveal>
      ))}
    </div>
  );
}
