import { ChevronLeft, ChevronRight } from "lucide-react";
import { DAYS_OF_WEEK, MONTHS } from "../constants";
import type { DayStatus } from "../types";
import { getStatusClasses, isBookedStatus } from "../utils";

type AvailabilityCalendarCardProps = {
  month: number;
  year: number;
  monthKey: string;
  calendarCells: Array<number | null>;
  getDayStatus: (day: number) => DayStatus;
  getDayKey: (day: number) => string;
  isPastDay: (day: number) => boolean;
  onToggleDay: (day: number) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

export function AvailabilityCalendarCard({
  month,
  year,
  monthKey,
  calendarCells,
  getDayStatus,
  getDayKey,
  isPastDay,
  onToggleDay,
  onPreviousMonth,
  onNextMonth,
}: AvailabilityCalendarCardProps) {
  return (
    <div className="max-h-125 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-5 sm:rounded-xl sm:border-gray-200 sm:shadow-sm">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h2 className="text-base font-semibold text-slate-900 sm:text-xl sm:font-bold">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPreviousMonth}
            className="rounded-lg bg-slate-100 p-1.5 transition-colors hover:bg-slate-200 sm:bg-transparent sm:p-2 sm:hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600 sm:h-5 sm:w-5" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="rounded-lg bg-slate-100 p-1.5 transition-colors hover:bg-slate-200 sm:bg-transparent sm:p-2 sm:hover:bg-gray-100"
          >
            <ChevronRight className="h-4 w-4 text-slate-600 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-2">
        {DAYS_OF_WEEK.map((dayLabel) => (
          <div key={dayLabel} className="py-1 text-center text-[11px] font-semibold text-slate-500 sm:text-sm sm:text-slate-600">
            {dayLabel}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {calendarCells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${monthKey}-${index}`} className="h-11 sm:h-16" />;
          }

          const status = getDayStatus(day);
          const dayKey = getDayKey(day);
          const isPast = isPastDay(day);
          const disabled = isPast;
          const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
          const isBooked = isBookedStatus(status);

          return (
            <button
              key={`${monthKey}-${day}`}
              type="button"
              disabled={disabled}
              onClick={() => onToggleDay(day)}
              title={`${dayKey}: ${statusLabel}${isPast ? " (Past date)" : ""}`}
              className={`flex h-11 w-full items-center justify-center rounded-lg border text-xs font-semibold transition-colors sm:h-16 sm:text-sm ${
                isPast
                  ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                  : getStatusClasses(status, { isLockedBooked: false })
              }`}
            >
              <span className="flex flex-col items-center leading-tight">
                <span>{day}</span>
                {isBooked ? <span className="text-[10px] uppercase tracking-wide">B</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
