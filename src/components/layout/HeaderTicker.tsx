import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { DEFAULT_HEADER_TICKER_MESSAGES, getHeaderTickerMessages } from "@/lib/header-ticker.functions";

export function HeaderTicker() {
  const fn = useAuthedServerFn(getHeaderTickerMessages);
  const ticker = useQuery({ queryKey: ["headerTickerMessages"], queryFn: () => fn(), staleTime: 30_000 });
  const messages = useMemo(() => {
    const list = ticker.data?.messages?.length ? ticker.data.messages : DEFAULT_HEADER_TICKER_MESSAGES;
    const cleaned = list.map((message) => message.trim()).filter(Boolean);
    return cleaned.length ? cleaned : DEFAULT_HEADER_TICKER_MESSAGES;
  }, [ticker.data?.messages]);
  const [index, setIndex] = useState(0);
  const message = messages[index % Math.max(messages.length, 1)] ?? DEFAULT_HEADER_TICKER_MESSAGES[0];

  useEffect(() => {
    setIndex(0);
  }, [messages.join("|")]);

  return (
    <div className="header-ticker" aria-label="Mensagens do header">
      <div className="header-ticker-rail" aria-hidden="true" />
      <div className="header-ticker-single-wrap">
        <span
          className="header-ticker-single"
          key={`${index}-${message}`}
          onAnimationEnd={() => setIndex((current) => (messages.length ? (current + 1) % messages.length : 0))}
        >
          <span className="header-ticker-dot" />
          <span>{message}</span>
        </span>
      </div>
    </div>
  );
}
