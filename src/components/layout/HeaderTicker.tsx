import { useMemo } from "react";
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
  const lane = [...messages, ...messages, ...messages];

  return (
    <div className="header-ticker" aria-label="Mensagens do header">
      <div className="header-ticker-rail" aria-hidden="true" />
      <div className="header-ticker-track">
        {lane.map((message, index) => (
          <span className="header-ticker-item" key={`${index}-${message}`}>
            <span className="header-ticker-dot" />
            <span>{message}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
