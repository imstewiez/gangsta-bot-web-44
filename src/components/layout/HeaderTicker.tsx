import { type CSSProperties, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { DEFAULT_HEADER_TICKER_MESSAGES, getHeaderTickerMessages } from "@/lib/header-ticker.functions";

const SIDE_PADDING = 16;
const PX_PER_SECOND = 185;

export function HeaderTicker() {
  const fn = useAuthedServerFn(getHeaderTickerMessages);
  const ticker = useQuery({ queryKey: ["headerTickerMessages"], queryFn: () => fn(), staleTime: 30_000 });
  const messages = useMemo(() => {
    const list = ticker.data?.messages?.length ? ticker.data.messages : DEFAULT_HEADER_TICKER_MESSAGES;
    return list.map((message) => message.trim()).filter(Boolean);
  }, [ticker.data?.messages]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLSpanElement | null>(null);
  const [index, setIndex] = useState(0);
  const [metrics, setMetrics] = useState({ endX: 620, duration: 5.8 });
  const message = messages[index % Math.max(messages.length, 1)] ?? DEFAULT_HEADER_TICKER_MESSAGES[0];

  useLayoutEffect(() => {
    setIndex(0);
  }, [messages.join("|")]);

  useLayoutEffect(() => {
    const measure = () => {
      const containerWidth = wrapRef.current?.clientWidth || 900;
      const itemWidth = itemRef.current?.scrollWidth || Math.max(180, message.length * 9);
      const endX = Math.max(SIDE_PADDING + 120, containerWidth - itemWidth - SIDE_PADDING);
      const distance = Math.max(160, endX - SIDE_PADDING);
      setMetrics({ endX, duration: Math.max(4.2, Math.min(8.5, distance / PX_PER_SECOND)) });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [message]);

  return (
    <div ref={wrapRef} className="header-ticker" aria-label="Mensagens do header">
      <div className="header-ticker-rail" aria-hidden="true" />
      <div className="header-ticker-runner">
        <span
          ref={itemRef}
          key={`${index}-${message}-${metrics.endX}`}
          className="header-ticker-item"
          style={{
            "--ticker-start": `${SIDE_PADDING}px`,
            "--ticker-end": `${metrics.endX}px`,
            "--ticker-duration": `${metrics.duration}s`,
          } as CSSProperties}
          onAnimationEnd={() => setIndex((current) => (messages.length ? (current + 1) % messages.length : 0))}
        >
          <span className="header-ticker-dot" />
          <span>{message}</span>
        </span>
      </div>
    </div>
  );
}
