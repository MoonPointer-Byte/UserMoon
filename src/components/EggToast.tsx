import { useEffect } from "react";

type Props = {
  message: string | null;
  onDone: () => void;
  ms?: number;
};

export function EggToast({ message, onDone, ms = 3200 }: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(timer);
  }, [message, ms, onDone]);

  if (!message) return null;
  return (
    <div className="egg-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
