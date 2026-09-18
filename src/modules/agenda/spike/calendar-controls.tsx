import { LONG_DATE_FORMATTER, MONTH_FORMATTER } from "./calendar-config";
import type { Professional, ProfessionalId, SpikeView } from "./types";

type CalendarControlsProps = {
  date: Date;
  professionals: Professional[];
  selectedProfessionalIds: ProfessionalId[];
  view: SpikeView;
  onNavigate: (direction: "previous" | "next" | "reference") => void;
  onToggleProfessional: (professionalId: ProfessionalId) => void;
  onViewChange: (view: SpikeView) => void;
};

const VIEW_LABELS: Array<{ label: string; view: SpikeView }> = [
  { label: "Día", view: "day" },
  { label: "Semana", view: "week" },
  { label: "Mes", view: "month" },
];

export function CalendarControls({
  date,
  professionals,
  selectedProfessionalIds,
  view,
  onNavigate,
  onToggleProfessional,
  onViewChange,
}: CalendarControlsProps) {
  const periodLabel =
    view === "month" ? MONTH_FORMATTER.format(date) : LONG_DATE_FORMATTER.format(date);

  return (
    <div className="space-y-4" aria-label="Controles del calendario experimental">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {VIEW_LABELS.map(({ label, view: option }) => (
            <button
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                view === option
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              key={option}
              onClick={() => onViewChange(option)}
              type="button"
              aria-pressed={view === option}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => onNavigate("previous")}
            type="button"
          >
            Anterior
          </button>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => onNavigate("reference")}
            type="button"
          >
            Fecha de referencia
          </button>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => onNavigate("next")}
            type="button"
          >
            Siguiente
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Período visible
          </p>
          <p
            className="mt-1 capitalize text-lg font-bold text-slate-900"
            data-testid="period-label"
          >
            {periodLabel}
          </p>
        </div>

        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Profesionales visibles
          </legend>
          {professionals.map((professional) => {
            const isSelected = selectedProfessionalIds.includes(professional.id);
            const isLastSelected = isSelected && selectedProfessionalIds.length === 1;

            return (
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-500"
                } ${isLastSelected ? "cursor-not-allowed opacity-80" : ""}`}
                key={professional.id}
              >
                <input
                  checked={isSelected}
                  className="sr-only"
                  disabled={isLastSelected}
                  onChange={() => onToggleProfessional(professional.id)}
                  type="checkbox"
                />
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-current"
                  style={{ color: professional.color }}
                />
                {professional.name.replace(/^(Dra?\.) /, "")}
              </label>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
}
