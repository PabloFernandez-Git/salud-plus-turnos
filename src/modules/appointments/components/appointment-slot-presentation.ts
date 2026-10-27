export type VisualSlot = {
  starts_at: string;
  ends_at: string;
  local_date: string;
  local_start_time: string;
  local_end_date: string;
  local_end_time: string;
};

export type AvailabilityInterval = {
  weekday: number;
  startTime: string;
  endTime: string;
};

export type SlotRow =
  | { kind: "available"; slot: VisualSlot }
  | { kind: "unavailable"; startTime: string; endTime: string };

function minutes(time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return NaN;
  const value = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[1]) < 24 && Number(match[2]) < 60 ? value : NaN;
}

function time(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

// These rows are visual references only. The offered PostgreSQL slots remain
// the sole source of selectable instants, including DST and booking exclusions.
export function buildVisualSlotRows(
  date: string,
  weekday: number,
  duration: number,
  intervals: AvailabilityInterval[] | null,
  offered: VisualSlot[],
): SlotRow[] {
  const rows: SlotRow[] = offered
    .filter((slot) => slot.local_date === date)
    .map((slot) => ({ kind: "available", slot }));
  if (intervals && Number.isInteger(duration) && duration > 0 && duration <= 1440) {
    const offeredTimes = new Set(
      rows.map((row) =>
        row.kind === "available" ? `${row.slot.local_start_time}/${row.slot.local_end_time}` : "",
      ),
    );
    const placeholderTimes = new Set<string>();
    const dayIntervals = intervals
      .filter((interval) => interval.weekday === weekday)
      .map((interval) => ({ start: minutes(interval.startTime), end: minutes(interval.endTime) }))
      .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && start < end)
      .sort((a, b) => a.start - b.start);
    let count = 0;
    function addPlaceholder(start: number, end: number) {
      const startTime = time(start);
      const endTime = time(end);
      const key = `${startTime}/${endTime}`;
      if (!offeredTimes.has(key) && !placeholderTimes.has(key)) {
        placeholderTimes.add(key);
        rows.push({ kind: "unavailable", startTime, endTime });
      }
    }
    for (const [index, interval] of dayIntervals.entries()) {
      if (count >= 288) break;
      const { start, end } = interval;
      for (let cursor = start; cursor + duration <= end && count < 288; cursor += duration) {
        count++;
        addPlaceholder(cursor, cursor + duration);
      }
      const next = dayIntervals[index + 1];
      if (next && next.start > end) {
        for (let cursor = end; cursor < next.start && count < 288; cursor += duration) {
          count++;
          addPlaceholder(cursor, Math.min(cursor + duration, next.start));
        }
      }
    }
  }
  return rows.sort((a, b) => {
    const startA = a.kind === "available" ? a.slot.local_start_time : a.startTime;
    const startB = b.kind === "available" ? b.slot.local_start_time : b.startTime;
    if (startA !== startB) return startA.localeCompare(startB);
    if (a.kind !== b.kind) return a.kind === "available" ? -1 : 1;
    if (a.kind === "available" && b.kind === "available") {
      return a.slot.starts_at.localeCompare(b.slot.starts_at);
    }
    return 0;
  });
}
