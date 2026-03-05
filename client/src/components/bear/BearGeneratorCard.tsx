import React from "react";
import type { TFunction } from "i18next";

type BearGroup = "bear1" | "bear2";

type Props = {
  t: TFunction;
  hostCount: number;
  selectedBearGroup: BearGroup;
  rallyOrder: string;
  onHostCountChange: (value: number) => void;
  onSelectedBearGroupChange: (value: BearGroup) => void;
  onGenerate: (group: BearGroup) => void;
  onCopy: () => void;
  canGenerate: boolean;
};

function BearGeneratorCard({
  t,
  hostCount,
  selectedBearGroup,
  rallyOrder,
  onHostCountChange,
  onSelectedBearGroupChange,
  onGenerate,
  onCopy,
  canGenerate
}: Props) {
  return (
    <section className="ui-card">
      <div className="ui-section-header">
        <h2 className="ui-section-title">{t("bear.generatorTitle")}</h2>
        <p className="ui-section-subtitle">{t("bear.generatorSubtitle")}</p>
      </div>
      <div className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(2,minmax(0,1fr))_auto] nav:items-end">
        <label className="ui-field">
          {t("bear.numberOfHosts")}
          <input
            className="ui-input"
            type="number"
            value={hostCount}
            onChange={(e) => onHostCountChange(Number(e.target.value))}
            min="1"
            max="50"
          />
        </label>
        <label className="ui-field">
          {t("bear.bearGroup")}
          <select
            className="ui-select"
            value={selectedBearGroup}
            onChange={(e) => onSelectedBearGroupChange(e.target.value as BearGroup)}
          >
            <option value="bear1">{t("bear.bear1")}</option>
            <option value="bear2">{t("bear.bear2")}</option>
          </select>
        </label>
        <button
          className="ui-button ui-button-wide nav:justify-self-end"
          type="button"
          onClick={() => onGenerate(selectedBearGroup)}
          disabled={!canGenerate}
        >
          {t("bear.generateOrder")}
        </button>
      </div>
      {rallyOrder && (
        <div className="mt-5">
          <div className="ui-codeblock">{rallyOrder}</div>
          <button className="ui-button-ghost mt-3" type="button" onClick={onCopy}>
            {t("bear.copyToClipboard")}
          </button>
        </div>
      )}
    </section>
  );
}

export default BearGeneratorCard;
