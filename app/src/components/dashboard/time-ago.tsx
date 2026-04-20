"use client";

import { useEffect, useState } from "react";

function formatRelativeTime(date: Date | string, now: number) {
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function TimeAgo({ date }: { date: Date | string }) {
  const [label, setLabel] = useState("just now");

  useEffect(() => {
    const updateLabel = () => {
      setLabel(formatRelativeTime(date, Date.now()));
    };

    updateLabel();

    const intervalId = window.setInterval(updateLabel, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [date]);

  return <span>{label}</span>;
}
