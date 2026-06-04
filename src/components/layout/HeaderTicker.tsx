import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { DEFAULT_HEADER_TICKER_MESSAGES, getHeaderTickerMessages } from "@/lib/header-ticker.functions";

const PX_PER_SECOND = 118;
const SIDE_PADDING = 18;
const MESSAGE_GAP_MS = 35;

export function HeaderTicker() {
  const fn = useAuthedServerFn(getHeaderTickerMessages);
  const ticker = useQuery({ queryKey: ["headerTickerMessages"], queryFn: () => fn(), staleTime: 30_000 });
  const messages = useMemo(() => {
    const list = ticker.data?.messages?.length ? ticker.data.messages : DEFAULT_HEADER_TICKER_MESSAGES;
    return list.map((message) => message.trim()).filter(Boolean);
  }, [ticker.data?.messages]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const [index, setIndex] = useState(0);
  const [motion, setMotion] = useState({ x: SIDE_PADDING, duration: 0, visible: false });
  const message = messages[index % Math.max(messages.length, 1)] ?? DEFAULT_HEADER_TICKER_MESSAGES[0];

  useEffect(() => {
    setIndex(0);
  }, [messages.join("|")]);

  useEffect(() => {
    if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);

    const wrapper = wrapRef.current;
    const item = itemRef.current;
    if (!wrapper || !item) return;

    const containerWidth = wrapper.offsetWidth || 900;
    const itemWidth = item.offsetWidth || Math.max(180, message.length * 9);
    const startX = SIDE_PADDING;
    const availableEnd = containerWidth - itemWidth - SIDE_PADDING;
    const endX = availableEnd > startX + 80 ? availableEnd : containerWidth + SIDE_PADDING;
    const distance = Math.abs(endX - startX);
    const duration = Math.max(5.2, Math.min(11.5, distance / PX_PER_SECOND));

    setMotion({ x: startX, duration: 0, visible: true });

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = window.requestAnimationFrame(() => {
        setMotion({ x: endX, duration, visible: true });
      });
    });

    timeoutRef.current = window.setTimeout(() => {
      setIndex((current) => (messages.length ? (current + 1) % messages.length : 0));
    }, duration * 1000 + MESSAGE_GAP_MS);

    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    };
  }, [index, message, messages.length]);

  return (
    <div ref={wrapRef} className="header-ticker" aria-label="Mensagens do header">
      <div className="header-ticker-runner">
        <span
          ref={itemRef}
          className="header-ticker-item"
          style={{
            transform: `translate3d(${motion.x}px, -50%, 0)`,
            transition: motion.duration > 0 ? `transform ${motion.duration}s linear` : "none",
            opacity: motion.visible ? 1 : 0,
          } as CSSProperties}
        >
          <span className="header-ticker-dot" />
          <span>{message}</span>
        </span>
      </div>
    </div>
  );
}
