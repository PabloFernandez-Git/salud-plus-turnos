import { describe, expect, it } from "vitest";
import { buildVisualSlotRows } from "./appointment-slot-presentation";

describe("visual slot references", () => {
  it("fills the break between two availability intervals with disabled-only rows", () => {
    const rows = buildVisualSlotRows(
      "2026-10-20",
      2,
      30,
      [
        { weekday: 2, startTime: "09:00", endTime: "10:00" },
        { weekday: 2, startTime: "12:00", endTime: "13:00" },
      ],
      [
        {
          starts_at: "2026-10-20T12:00:00Z",
          ends_at: "2026-10-20T12:30:00Z",
          local_date: "2026-10-20",
          local_start_time: "09:00",
          local_end_date: "2026-10-20",
          local_end_time: "09:30",
        },
      ],
    );
    expect(rows[0].kind).toBe("available");
    expect(rows).toContainEqual({ kind: "unavailable", startTime: "10:00", endTime: "10:30" });
    expect(rows).toContainEqual({ kind: "unavailable", startTime: "11:30", endTime: "12:00" });
    expect(rows.filter((row) => row.kind === "available")).toHaveLength(1);
  });

  it("keeps repeated civil SQL slots in deterministic instant order", () => {
    const local = {
      local_date: "2026-11-01",
      local_start_time: "01:30",
      local_end_date: "2026-11-01",
      local_end_time: "02:00",
    };
    const rows = buildVisualSlotRows("2026-11-01", 7, 30, null, [
      { ...local, starts_at: "2026-11-01T06:30:00Z", ends_at: "2026-11-01T07:00:00Z" },
      { ...local, starts_at: "2026-11-01T05:30:00Z", ends_at: "2026-11-01T06:00:00Z" },
    ]);
    expect(rows.map((row) => row.kind === "available" && row.slot.starts_at)).toEqual([
      "2026-11-01T05:30:00Z",
      "2026-11-01T06:30:00Z",
    ]);
  });
});
