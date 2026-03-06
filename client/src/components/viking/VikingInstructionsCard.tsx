import React from "react";
import type { TFunction } from "i18next";

type Props = {
  t: TFunction;
};

function VikingInstructionsCard({ t }: Props) {
  return (
    <section className="ui-card" data-testid="viking-instructions">
      <div className="ui-section-header">
        <h2 className="ui-section-title">{t("viking.instructionsTitle")}</h2>
      </div>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
        <li>{t("viking.instructions.equalize")}</li>
        <li>{t("viking.instructions.sendAll")}</li>
        <li>{t("viking.instructions.garrison")}</li>
        <li>{t("viking.instructions.reinforceHeroes")}</li>
      </ul>
      <p className="mt-4 text-sm text-muted">{t("viking.instructions.subtext")}</p>
    </section>
  );
}

export default VikingInstructionsCard;
