import { readableCivilDate } from "@/modules/appointments/search/appointment-search";
import { blockReasonLabels } from "../schemas/availability-block";
import type { AvailabilityBlock } from "../server/availability-blocks";

export function AvailabilityBlocksSection({ blocks }: { blocks: AvailabilityBlock[] }) {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5"
      aria-labelledby="blocks-title"
    >
      <h2 id="blocks-title" className="text-xl font-semibold text-slate-950">
        Bloqueos excepcionales
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Vacaciones, ausencias, feriados y otros motivos. No se ofrecen horarios nuevos en estas
        fechas.
      </p>
      {blocks.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No hay bloqueos excepcionales para este profesional.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 px-4">
          {blocks.map((block) => (
            <li
              key={block.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <span className="font-medium text-slate-900">
                {readableCivilDate(block.startDate)}
                {block.startDate !== block.endDate && ` – ${readableCivilDate(block.endDate)}`}
              </span>
              <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-900">
                {blockReasonLabels[block.reason]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
