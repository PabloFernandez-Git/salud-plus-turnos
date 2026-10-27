"use client";

import { useEffect, useId, useRef, useState } from "react";
import { readableCivilDate } from "../search/appointment-search";

const months = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const weekdayNames = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function parts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function civilDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// Gregorian calendar arithmetic only: no browser/device timezone participates.
export function civilWeekday(date: string) {
  const { year: civilYear, month, day } = parts(date);
  const year = civilYear - (month < 3 ? 1 : 0);
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const sundayZero =
    (year +
      Math.floor(year / 4) -
      Math.floor(year / 100) +
      Math.floor(year / 400) +
      offsets[month - 1] +
      day) %
    7;
  return (sundayZero + 6) % 7;
}

function shiftDay(date: string, delta: number) {
  let { year, month, day } = parts(date);
  const direction = Math.sign(delta);
  for (let step = 0; step < Math.abs(delta); step++) {
    day += direction;
    if (day > daysInMonth(year, month)) {
      day = 1;
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    } else if (day < 1) {
      month--;
      if (month < 1) {
        month = 12;
        year--;
      }
      day = daysInMonth(year, month);
    }
  }
  return civilDate(year, month, day);
}

function shiftMonth(date: string, delta: number) {
  let { year, month, day } = parts(date);
  month += delta;
  if (month < 1) {
    month = 12;
    year--;
  }
  if (month > 12) {
    month = 1;
    year++;
  }
  day = Math.min(day, daysInMonth(year, month));
  return civilDate(year, month, day);
}

export function CivilDatePicker({
  value,
  referenceDate,
  disabled,
  error,
  onChange,
}: {
  value: string;
  referenceDate: string;
  disabled?: boolean;
  error?: boolean;
  onChange: (date: string) => void;
}) {
  const labelId = useId();
  const valueId = useId();
  const errorId = useId();
  const calendarId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const calendarOpen = open && !disabled;
  const [focusedDate, setFocusedDate] = useState(value || referenceDate);
  const { year, month } = parts(focusedDate);

  useEffect(() => {
    if (!calendarOpen) return;
    calendar.current
      ?.querySelector<HTMLButtonElement>(`[data-civil-date="${focusedDate}"]`)
      ?.focus();
  }, [calendarOpen, focusedDate]);
  useEffect(() => {
    if (!calendarOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [calendarOpen]);

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function onCalendarKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (!(event.target instanceof HTMLButtonElement) || !event.target.dataset.civilDate) return;
    const date = event.target.dataset.civilDate;
    const movements: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in movements) {
      event.preventDefault();
      setFocusedDate(shiftDay(date, movements[event.key]));
    } else if (event.key === "Home") {
      event.preventDefault();
      setFocusedDate(shiftDay(date, -civilWeekday(date)));
    } else if (event.key === "End") {
      event.preventDefault();
      setFocusedDate(shiftDay(date, 6 - civilWeekday(date)));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      setFocusedDate(shiftMonth(date, event.key === "PageUp" ? -1 : 1));
    }
  }

  const firstWeekday = civilWeekday(civilDate(year, month, 1));
  const totalDays = daysInMonth(year, month);
  const cells = Array.from(
    { length: Math.ceil((firstWeekday + totalDays) / 7) * 7 },
    (_, index) => {
      const day = index - firstWeekday + 1;
      return day >= 1 && day <= totalDays ? civilDate(year, month, day) : null;
    },
  );
  return (
    <div
      ref={root}
      className="min-w-0 text-sm font-semibold text-slate-800"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !root.current?.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <span id={labelId}>Fecha local del centro</span>
      <button
        ref={trigger}
        type="button"
        aria-labelledby={`${labelId} ${valueId}`}
        aria-expanded={calendarOpen}
        aria-controls={calendarId}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        className={`mt-1 flex min-h-11 w-full cursor-pointer items-center justify-between rounded-md border bg-white px-3 text-left font-normal text-slate-950 hover:border-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${error ? "border-red-500" : "border-slate-300"}`}
        onClick={() => {
          if (!calendarOpen) setFocusedDate(value || referenceDate);
          setOpen(!calendarOpen);
        }}
      >
        <span id={valueId}>{value ? readableCivilDate(value) : "Elegí una fecha"}</span>
        <span aria-hidden="true">▦</span>
      </button>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-normal text-red-700">
          Revisá la fecha seleccionada.
        </p>
      )}
      {calendarOpen && (
        <div
          ref={calendar}
          id={calendarId}
          role="group"
          aria-label="Calendario"
          onKeyDown={onCalendarKeyDown}
          className="mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Mes anterior"
              disabled={year <= 1 && month === 1}
              className="min-h-10 min-w-10 cursor-pointer rounded-md border border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed"
              onClick={() => setFocusedDate(shiftMonth(focusedDate, -1))}
            >
              ‹
            </button>
            <strong className="text-center capitalize" aria-live="polite">
              {months[month - 1]} {year}
            </strong>
            <button
              type="button"
              aria-label="Mes siguiente"
              disabled={year >= 9999 && month === 12}
              className="min-h-10 min-w-10 cursor-pointer rounded-md border border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed"
              onClick={() => setFocusedDate(shiftMonth(focusedDate, 1))}
            >
              ›
            </button>
          </div>
          <table className="w-full table-fixed text-center">
            <thead>
              <tr>
                {weekdays.map((day) => (
                  <th key={day} scope="col" className="pb-1 text-xs font-medium text-slate-600">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: cells.length / 7 }, (_, week) => (
                <tr key={week}>
                  {cells.slice(week * 7, week * 7 + 7).map((date, day) => (
                    <td key={`${week}-${day}`} className="p-0.5">
                      {date && (
                        <button
                          type="button"
                          data-civil-date={date}
                          aria-label={`${weekdayNames[civilWeekday(date)]} ${parts(date).day} de ${months[month - 1]} de ${year}`}
                          aria-pressed={value === date}
                          aria-current={referenceDate === date ? "date" : undefined}
                          tabIndex={focusedDate === date ? 0 : -1}
                          className={`min-h-10 w-full cursor-pointer rounded-md text-sm hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${value === date ? "bg-sky-700 font-bold text-white hover:bg-sky-800" : "text-slate-900"}`}
                          onClick={() => {
                            if (date !== value) onChange(date);
                            close(true);
                          }}
                        >
                          {parts(date).day}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs font-normal text-slate-600">
            Usá las flechas para cambiar de día y Re Pág/Av Pág para cambiar de mes.
          </p>
        </div>
      )}
    </div>
  );
}
