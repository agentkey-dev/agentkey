"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type OnboardingStepConfig = {
  key: string;
  label: string;
  complete: boolean;
  content: React.ReactNode;
  doneContent: React.ReactNode;
};

type DashboardOnboardingChecklistProps = {
  steps: OnboardingStepConfig[];
  allComplete: boolean;
};

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 5.5" />
    </svg>
  );
}

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Request failed.";
}

function OnboardingCodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-white/10 bg-surface-container-lowest p-3 font-mono text-xs leading-relaxed text-on-surface-variant">
      {children}
    </pre>
  );
}

export function DashboardOnboardingChecklist({
  steps,
  allComplete,
}: DashboardOnboardingChecklistProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) {
    return null;
  }

  function handleAction(endpoint: string, onSuccess: () => void) {
    setError(null);

    startTransition(async () => {
      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(data));
        return;
      }

      onSuccess();
      router.refresh();
    });
  }

  return (
    <section className="space-y-5 border border-primary/20 bg-primary/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
            Setup guide
          </div>
          <h2 className="text-lg font-semibold text-on-surface">
            Get started with AgentKey
          </h2>
          <p className="max-w-2xl text-sm text-on-surface-variant">
            Follow these steps to connect your first AI agent. Once complete,
            your workspace metrics and activity feed will appear here.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            handleAction("/api/admin/onboarding/dismiss", () =>
              setDismissed(true),
            )
          }
          className="shrink-0 text-sm text-on-surface-variant transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Working..." : "Dismiss"}
        </button>
      </div>

      <div className="grid gap-3">
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={`border p-5 ${
              step.complete
                ? "border-white/5 bg-white/5"
                : "border-white/10 bg-surface-container"
            }`}
          >
            <div className="flex items-start gap-4">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                  step.complete
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-primary/30 bg-primary text-on-primary"
                }`}
              >
                {step.complete ? (
                  <CheckIcon />
                ) : (
                  <span className="font-mono text-xs font-bold">
                    {index + 1}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div
                  className={`text-sm font-semibold ${
                    step.complete
                      ? "text-on-surface-variant"
                      : "text-on-surface"
                  }`}
                >
                  {step.label}
                </div>
                {step.complete ? step.doneContent : step.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      {allComplete ? (
        <div className="border border-white/10 bg-surface-container p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
            Recommended next
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-on-surface">
                Set up notifications
              </div>
              <p className="text-sm text-on-surface-variant">
                Get notified in Slack or via webhook when an agent requests
                access, so you don&apos;t have to check the dashboard manually.
              </p>
            </div>
            <Link
              href="/dashboard/notifications"
              className="shrink-0 border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-on-surface transition-colors hover:bg-white/10"
            >
              Configure
            </Link>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}

export { OnboardingCodeBlock };
