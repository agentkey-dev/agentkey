"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { unwrapResponseData } from "@/components/dashboard/api";

type NotificationSettings = {
  slackConfigured: boolean;
  slackWebhookPreview: string | null;
  discordConfigured: boolean;
  discordWebhookPreview: string | null;
  lastSlackDeliveryStatus: "success" | "failed" | null;
  lastSlackDeliveryAt: string | Date | null;
  lastSlackError: string | null;
  lastDiscordDeliveryStatus: "success" | "failed" | null;
  lastDiscordDeliveryAt: string | Date | null;
  lastDiscordError: string | null;
};

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Failed to update notifications.";
}

function DeliveryStatus({
  status,
  attemptedAt,
  error,
}: {
  status: "success" | "failed" | null;
  attemptedAt: string | Date | null;
  error: string | null;
}) {
  if (!status || !attemptedAt) {
    return (
      <p className="text-sm text-on-surface-variant">
        No delivery attempts yet.
      </p>
    );
  }

  return (
    <div className="space-y-1 text-sm text-on-surface-variant">
      <p>
        Last delivery:{" "}
        <span
          className={
            status === "success" ? "text-emerald-300" : "text-rose-300"
          }
        >
          {status}
        </span>{" "}
        at {new Date(attemptedAt).toLocaleString()}
      </p>
      {error ? <p className="text-rose-300">{error}</p> : null}
    </div>
  );
}

export function NotificationsForm({
  settings,
}: {
  settings: NotificationSettings;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const hasRecentFailure =
    settings.lastSlackDeliveryStatus === "failed" ||
    settings.lastDiscordDeliveryStatus === "failed";

  return (
    <div className="space-y-6 border border-white/10 bg-surface-container p-6">
      {hasRecentFailure ? (
        <div className="border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          A recent webhook delivery failed. Review the provider-specific status
          below and update the webhook if needed.
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-on-surface">
          Webhook destinations
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Get notified when agents submit access requests or suggest new tools.
          Save one Slack webhook, one Discord webhook, or both.
        </p>
      </div>

      <form
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);

          const payload = {
            slackWebhook: String(formData.get("slackWebhook") ?? "").trim(),
            discordWebhook: String(formData.get("discordWebhook") ?? "").trim(),
            clearSlack: formData.get("clearSlack") === "on",
            clearDiscord: formData.get("clearDiscord") === "on",
          };

          setError(null);

          startTransition(async () => {
            const response = await fetch("/api/admin/notifications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok) {
              setError(getErrorMessage(data));
              return;
            }

            unwrapResponseData<NotificationSettings>(data);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            form.reset();
            router.refresh();
          });
        }}
      >
        <section className="grid gap-4 border border-white/10 bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-on-surface">Slack</h3>
              <p className="text-sm text-on-surface-variant">
                {settings.slackConfigured
                  ? `Configured: ${settings.slackWebhookPreview}`
                  : "Not configured"}
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-primary">
              Incoming webhook
            </span>
          </div>
          <label className="grid gap-2 text-sm text-on-surface-variant">
            {settings.slackConfigured ? "Replace Slack webhook" : "Slack webhook URL"}
            <input
              name="slackWebhook"
              type="url"
              className="border border-white/10 bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
              placeholder="https://hooks.slack.com/services/..."
            />
            <span className="text-xs text-on-surface-variant">
              Create one at{" "}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                api.slack.com/apps
              </a>
              {" → Incoming Webhooks → Add New Webhook to Workspace"}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input name="clearSlack" type="checkbox" />
            Remove Slack destination
          </label>
          <DeliveryStatus
            status={settings.lastSlackDeliveryStatus}
            attemptedAt={settings.lastSlackDeliveryAt}
            error={settings.lastSlackError}
          />
        </section>

        <section className="grid gap-4 border border-white/10 bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-on-surface">
                Discord
              </h3>
              <p className="text-sm text-on-surface-variant">
                {settings.discordConfigured
                  ? `Configured: ${settings.discordWebhookPreview}`
                  : "Not configured"}
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-primary">
              Channel webhook
            </span>
          </div>
          <label className="grid gap-2 text-sm text-on-surface-variant">
            {settings.discordConfigured ? "Replace Discord webhook" : "Discord webhook URL"}
            <input
              name="discordWebhook"
              type="url"
              className="border border-white/10 bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
              placeholder="https://discord.com/api/webhooks/..."
            />
            <span className="text-xs text-on-surface-variant">
              In Discord: channel settings → Integrations → Webhooks → New Webhook → Copy URL
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input name="clearDiscord" type="checkbox" />
            Remove Discord destination
          </label>
          <DeliveryStatus
            status={settings.lastDiscordDeliveryStatus}
            attemptedAt={settings.lastDiscordDeliveryAt}
            error={settings.lastDiscordError}
          />
        </section>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {saved ? (
          <p className="text-sm text-emerald-400">
            Notification settings saved.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save notifications"}
        </button>
      </form>
    </div>
  );
}
