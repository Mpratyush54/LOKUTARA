"use client";

import { useEffect, useState } from "react";

type ToastListener = (message: string) => void;
const listeners = new Set<ToastListener>();

export function showAppToast(message: string) {
  const text = message.trim();
  if (!text) return;
  for (const listener of listeners) listener(text);
}

export function AppToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const listener: ToastListener = (next) => setMessage(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div className="app-toast" role="alert" data-testid="app-toast">
      {message}
    </div>
  );
}
