"use client";

import { useEffect, useState } from "react";

type Line = {
  type: "prompt" | "output" | "success" | "info" | "dim";
  text: string;
  delay: number; // ms after previous line
};

const SEQUENCE: Line[] = [
  { type: "prompt", text: "GET /api/tools", delay: 0 },
  { type: "output", text: '  Linear        "approved"', delay: 800 },
  { type: "output", text: '  GitHub        "none"', delay: 400 },
  { type: "output", text: '  Notion        "denied"  → "Use shared wiki bot"', delay: 400 },
  { type: "dim", text: "", delay: 1500 },

  { type: "prompt", text: 'POST /api/tools/github/request', delay: 500 },
  { type: "info", text: '  reason: "Need to open PRs for bug fixes"', delay: 700 },
  { type: "success", text: '  ✓ Request submitted. Awaiting human review.', delay: 900 },
  { type: "dim", text: "", delay: 2000 },

  { type: "prompt", text: "POST /api/tools/suggest", delay: 500 },
  { type: "info", text: '  name: "Slack"  url: "https://slack.com"', delay: 600 },
  { type: "info", text: '  reason: "Need to post incident alerts"', delay: 500 },
  { type: "success", text: "  ✓ Suggestion submitted. Admin will review.", delay: 900 },
  { type: "dim", text: "", delay: 2000 },

  { type: "prompt", text: "GET /api/tools/linear/credentials", delay: 500 },
  { type: "success", text: '  ✓ credential: "lin_api_•••••••"', delay: 800 },
  { type: "output", text: '  auth_type: "api_key"', delay: 300 },
  { type: "output", text: "  instructions:", delay: 300 },
  { type: "dim", text: "    Use as Bearer token.", delay: 250 },
  { type: "dim", text: "    Base URL: https://api.linear.app", delay: 250 },
  { type: "dim", text: "    Team: ACME (ID: abc123)", delay: 250 },
  { type: "dim", text: '    Labels: always add "bot" label', delay: 250 },
];

export function HeroTerminal() {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (visibleLines >= SEQUENCE.length) {
      // Restart after a pause
      const restart = setTimeout(() => setVisibleLines(0), 6000);
      return () => clearTimeout(restart);
    }

    const nextLine = SEQUENCE[visibleLines];
    const timer = setTimeout(
      () => setVisibleLines((n) => n + 1),
      nextLine.delay,
    );
    return () => clearTimeout(timer);
  }, [visibleLines]);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border border-outline-variant bg-surface-container-lowest">
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-outline-variant/30 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-error/40" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/40" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary/40" />
        </div>
        <span className="font-mono text-[10px] text-on-surface-variant/50">
          agent@company ~ agentkey
        </span>
      </div>

      {/* Terminal body */}
      <div className="h-[420px] overflow-hidden p-5 font-mono text-[13px] leading-relaxed">
        {SEQUENCE.slice(0, visibleLines).map((line, i) => {
          if (line.type === "dim" && !line.text) {
            return <div key={i} className="h-3" />;
          }

          const colorClass = {
            prompt: "text-primary font-semibold",
            output: "text-on-surface",
            success: "text-emerald-400",
            info: "text-on-surface-variant",
            dim: "text-on-surface-variant/50",
          }[line.type];

          return (
            <div key={i} className={colorClass}>
              {line.type === "prompt" ? (
                <>
                  <span className="text-on-surface-variant/40">$ </span>
                  {line.text}
                </>
              ) : (
                line.text
              )}
            </div>
          );
        })}
        {/* Cursor */}
        <span
          className={`inline-block h-4 w-2 bg-primary ${cursorVisible ? "opacity-80" : "opacity-0"}`}
        />
      </div>
    </div>
  );
}
