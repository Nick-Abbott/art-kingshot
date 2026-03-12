import React from "react";
import type { TFunction } from "i18next";

type Props = {
  t: TFunction;
  bear1Count: number;
  bear2Count: number;
  bear1Label: string;
  bear2Label: string;
};

function BearHeader({ t, bear1Count, bear2Count, bear1Label, bear2Label }: Props) {
  return (
    <header className="relative z-[1] mb-8 flex flex-col gap-6 nav:flex-row nav:items-start nav:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-accent-dark">
          {t("bear.eyebrow")}
        </p>
        <h1 className="mt-2 font-['DM Serif Display'] text-[clamp(2.4rem,3vw,3.5rem)]">
          {t("bear.title")}
        </h1>
        <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed text-muted">
          {t("bear.subtitle")}
        </p>
      </div>
      <div className="ui-card-compact grid gap-4 nav:min-w-[240px] nav:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-muted">
            {bear1Label}
          </p>
          <p className="text-2xl font-semibold" data-testid="bear1-count">
            {bear1Count}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-muted">
            {bear2Label}
          </p>
          <p className="text-2xl font-semibold" data-testid="bear2-count">
            {bear2Count}
          </p>
        </div>
      </div>
    </header>
  );
}

export default BearHeader;
