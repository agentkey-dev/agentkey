"use client";

import { useId, useState, type ComponentProps } from "react";

type CredentialTextareaProps = Omit<
  ComponentProps<"textarea">,
  "spellCheck" | "autoComplete" | "autoCapitalize" | "autoCorrect" | "style"
>;

export function CredentialTextarea({
  id,
  className,
  disabled,
  ...props
}: CredentialTextareaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="grid gap-1.5">
      <textarea
        {...props}
        id={fieldId}
        disabled={disabled}
        aria-label={props["aria-label"] ?? "Credential"}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={[className, revealed ? "" : "[-webkit-text-security:disc]"]
          .filter(Boolean)
          .join(" ")}
      />
      <button
        type="button"
        disabled={disabled}
        aria-controls={fieldId}
        aria-pressed={revealed}
        onClick={() => setRevealed((value) => !value)}
        className="justify-self-end text-xs text-on-surface-variant hover:text-on-surface disabled:opacity-50"
      >
        {revealed ? "Hide credential" : "Show credential"}
      </button>
    </div>
  );
}
