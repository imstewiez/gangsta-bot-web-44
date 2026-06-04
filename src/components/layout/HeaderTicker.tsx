import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { DEFAULT_HEADER_TICKER_MESSAGES, getHeaderTickerMessages } from "@/lib/header-ticker.functions";

const SIDE_PADDING = 16;
const MIN_DURATION_MS = 3600;
const MAX_DURATION_MS = 6200;

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
  const [index, setIndex] = useState(0);
  const message = messages[index % Math.max(messages.length, 1)] ?? DEFAULT_HEADER_TICKER_MESSAGES[0];

  useEffect(() => {
    setIndex(0);
  }, [messages.join("|")]);

  useEffect(() => {
    if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);

    const wrapper = wrapRef.current;
    const item = itemRef.current;
    if (!wrapper || !item) return;

    let cancelled = false;
    let startTime: number | null = null;
    const containerWidth = wrapper.clientWidth || 900;
    const itemWidth = item.scrollWidth || Math.max(160, message.length * 9);
    const startX = SIDE_PADDING;
    const endX = Math.max(startX + 180, containerWidth - itemWidth - SIDE_PADDING);
    const duration = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, (endX - startX) * 6.2));

    item.style.opacity = "1";
    item.style.transform = `translate3d(${startX}px, -50%, 0)`;

    const tick = (now: number) => {
      if (cancelled) return;
      if (startTime == null) startTime = now;
      const progress = Math.min(1, (now - startTime) / duration);
      const x = startX + (endX - startX) * progress;
      item.style.transform = `translate3d(${x}px, -50%, 0)`;
      item.style.opacity = progress > 0.97 ? String(Math.max(0, (1 - progress) / 0.03)) : "1";

      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        item.style.opacity = "0";
        setIndex((current) => (messages.length ? (current + 1) % messages.length : 0));
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [index, message, messages.length]);

  return (
    <div ref={wrapRef} className="header-ticker" aria-label="Mensagens do header">
      <div className="header-ticker-rail" aria-hidden="true" />
      <div className="header-ticker-runner">
        <span ref={itemRef} key={`${index}-${message}`} className="header-ticker-item">
          <span className="header-ticker-dot" />
          <span>{message}</span>
        </span>
      </div>
    </div>
  );
}
