import { useCallback, useEffect, useState } from "react";
import type { AllianceSettings } from "@shared/types";
import {
  formatDateTimeInputFromUtcIso,
  parseDateTimeInputToUtcIso
} from "../utils/time";

export type TimeMode = "local" | "utc";

type Params = {
  enabled: boolean;
  settings?: AllianceSettings;
  onChange?: () => void;
};

type AdminBearTimeState = {
  timeMode: TimeMode;
  setTimeMode: (next: TimeMode) => void;
  bear1Input: string;
  bear2Input: string;
  viking1Input: string;
  viking2Input: string;
  setBear1Input: (value: string) => void;
  setBear2Input: (value: string) => void;
  setViking1Input: (value: string) => void;
  setViking2Input: (value: string) => void;
  isDirty: boolean;
  markClean: () => void;
};

export function useAdminBearTimeSettings({
  enabled,
  settings,
  onChange
}: Params): AdminBearTimeState {
  const [timeMode, setTimeModeState] = useState<TimeMode>("local");
  const [bear1Input, setBear1InputState] = useState("");
  const [bear2Input, setBear2InputState] = useState("");
  const [viking1Input, setViking1InputState] = useState("");
  const [viking2Input, setViking2InputState] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const markClean = useCallback(() => setIsDirty(false), []);

  const setBear1Input = useCallback(
    (value: string) => {
      setBear1InputState(value);
      setIsDirty(true);
      onChange?.();
    },
    [onChange]
  );

  const setBear2Input = useCallback(
    (value: string) => {
      setBear2InputState(value);
      setIsDirty(true);
      onChange?.();
    },
    [onChange]
  );

  const setViking1Input = useCallback(
    (value: string) => {
      setViking1InputState(value);
      setIsDirty(true);
      onChange?.();
    },
    [onChange]
  );

  const setViking2Input = useCallback(
    (value: string) => {
      setViking2InputState(value);
      setIsDirty(true);
      onChange?.();
    },
    [onChange]
  );

  const setTimeMode = useCallback(
    (nextMode: TimeMode) => {
      if (nextMode === timeMode) return;
      const bear1Utc = parseDateTimeInputToUtcIso(bear1Input, timeMode);
      const bear2Utc = parseDateTimeInputToUtcIso(bear2Input, timeMode);
      const viking1Utc = parseDateTimeInputToUtcIso(viking1Input, timeMode);
      const viking2Utc = parseDateTimeInputToUtcIso(viking2Input, timeMode);
      setTimeModeState(nextMode);
      if (bear1Utc) {
        setBear1InputState(formatDateTimeInputFromUtcIso(bear1Utc, nextMode));
      }
      if (bear2Utc) {
        setBear2InputState(formatDateTimeInputFromUtcIso(bear2Utc, nextMode));
      }
      if (viking1Utc) {
        setViking1InputState(formatDateTimeInputFromUtcIso(viking1Utc, nextMode));
      }
      if (viking2Utc) {
        setViking2InputState(formatDateTimeInputFromUtcIso(viking2Utc, nextMode));
      }
      onChange?.();
    },
    [bear1Input, bear2Input, onChange, timeMode, viking1Input, viking2Input]
  );

  useEffect(() => {
    if (!enabled || isDirty) return;
    setBear1InputState(
      formatDateTimeInputFromUtcIso(settings?.bearNextTimes?.bear1, timeMode)
    );
    setBear2InputState(
      formatDateTimeInputFromUtcIso(settings?.bearNextTimes?.bear2, timeMode)
    );
    setViking1InputState(
      formatDateTimeInputFromUtcIso(settings?.vikingNextTimes?.viking1, timeMode)
    );
    setViking2InputState(
      formatDateTimeInputFromUtcIso(settings?.vikingNextTimes?.viking2, timeMode)
    );
  }, [
    enabled,
    isDirty,
    settings?.bearNextTimes?.bear1,
    settings?.bearNextTimes?.bear2,
    settings?.vikingNextTimes?.viking1,
    settings?.vikingNextTimes?.viking2,
    timeMode
  ]);

  return {
    timeMode,
    setTimeMode,
    bear1Input,
    bear2Input,
    viking1Input,
    viking2Input,
    setBear1Input,
    setBear2Input,
    setViking1Input,
    setViking2Input,
    isDirty,
    markClean
  };
}
