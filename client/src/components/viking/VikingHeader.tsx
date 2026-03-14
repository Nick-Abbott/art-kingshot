import React from "react";
import type { TFunction } from "i18next";

type Props = {
  t: TFunction;
  memberCount: number;
  nextEventsLabel: string;
  nextEvents: string;
  onReset: () => void;
  busy: boolean;
  canManage: boolean;
};

function VikingHeader({
  t,
  memberCount,
  nextEventsLabel,
  nextEvents,
  onReset,
  busy,
  canManage
}: Props) {
  return (
    <header className="relative z-[1] mb-8 flex flex-col gap-6 nav:flex-row nav:items-start nav:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-accent-dark">
          {t("viking.eyebrow")}
        </p>
        <h1 className="mt-2 font-['DM Serif Display'] text-[clamp(2.4rem,3vw,3.5rem)]">
          {t("viking.title")}
        </h1>
        <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed text-muted">
          {t("viking.subtitle")}
        </p>
      </div>
      <div className="ui-card-compact grid gap-4 nav:min-w-[320px]">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-muted">
            {t("viking.signedUp")}
          </p>
          <p className="text-2xl font-semibold" data-testid="viking-signed-count">
            {memberCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-muted">
            {nextEventsLabel}
          </p>
          <p className="text-sm font-semibold text-ink" data-testid="viking-next-events">
            {nextEvents}
          </p>
        </div>
        <button
          className="ui-button-ghost w-full text-xs uppercase tracking-[0.1em]"
          data-testid="viking-reset-event"
          type="button"
          onClick={onReset}
          disabled={busy || !canManage}
        >
          {t("viking.resetEvent")}
        </button>
      </div>
    </header>
  );
}

export default VikingHeader;
