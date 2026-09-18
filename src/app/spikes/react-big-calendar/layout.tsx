import type { ReactNode } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/modules/agenda/spike/react-big-calendar-spike.css";

export default function ReactBigCalendarSpikeLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
