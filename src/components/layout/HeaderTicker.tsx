import { useEffect, useState } from "react";

const MESSAGES = [
  "Ballas Gang!",
  "É a firma moh!",
  "Sim sim...",
  "Bora meter atividade!",
];

const INTERVAL_MS = 5200;

export function HeaderTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="liquid-content header-ticker min-w-0 order-3 lg:order-none" aria-label="Mensagens do header">
      <div className="header-ticker-runner" key={`${index}-${MESSAGES[index]}`}>
        <span className="header-ticker-item">
          <span className="header-ticker-dot" />
          {MESSAGES[index]}
        </span>
      </div>
    </div>
  );
}
