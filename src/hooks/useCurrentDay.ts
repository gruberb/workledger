import { useState, useCallback } from "react";
import { todayKey } from "../utils/dates.ts";

export function useCurrentDay() {
  const [currentDay, setCurrentDay] = useState(todayKey());

  const goToDay = useCallback((dayKey: string) => {
    setCurrentDay(dayKey);
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDay(todayKey());
  }, []);

  return { currentDay, goToDay, goToToday };
}
