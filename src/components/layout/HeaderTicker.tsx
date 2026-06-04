import { useQuery } from "@tanstack/react-query";

import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { DEFAULT_HEADER_TICKER_MESSAGES, getHeaderTickerMessages } from "@/lib/header-ticker.functions";

export function HeaderTicker() {
  const fn = useAuthedServerFn(getHeaderTickerMessages);
  const ticker = useQuery({ queryKey: ["headerTickerMessages"], queryFn: () => fn(), staleTime: 30_000 });
  const messages = ticker.data?.messages?.length ? ticker.data.messages : DEFAULT_HEADER_TICKER_MESSAGES;
  const renderedMessages = messages.length > 1 ? [...messages, ...messages] : [...messages, ...messages, ...messages];

  return (
    <div className="header-ticker" aria-label="Mensagens do header">
      <div className="header-ticker-track">
        {renderedMessages.map((message, index) => (
          <span className="header-ticker-item" key={`${index}-${message}`}>
            <span className="header-ticker-dot" />
            <span>{message}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
