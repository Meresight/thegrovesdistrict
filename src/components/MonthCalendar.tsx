"use client";

import { addDays, isValidDate } from "@/lib/time";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function MonthCalendar({
  selectedDate,
  onSelectDate,
  minDate,
  maxDate,
}: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  minDate: string;
  maxDate: string;
}) {
  // Current viewed month date (first of month)
  const d = new Date(`${selectedDate || minDate}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-indexed

  // Month title formatter (e.g. "October 2026")
  const monthTitle = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);

  // Calculate calendar grid
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  // JS day 0 is Sunday, so for Monday-first: (day + 6) % 7
  const startDay = (firstDayOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

  const isPrevDisabled = true; // Cannot navigate to past months
  const isNextDisabled = true; // Booking is strictly for the current month

  function prevMonth() {
    // Current month only
  }

  function nextMonth() {
    // Current month only
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
      {/* Month Header */}
      <div className="flex items-center justify-between pb-4 border-b border-line">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">{monthTitle}</h3>
          <p className="text-[10px] text-mute font-mono uppercase tracking-wider mt-0.5">
            Select Play Date
          </p>
        </div>
        {selectedDate !== minDate && (
          <button
            type="button"
            onClick={() => onSelectDate(minDate)}
            className="font-mono text-[10px] uppercase tracking-wider text-ink underline hover:opacity-70 cursor-pointer"
          >
            Today
          </button>
        )}
      </div>

      {/* Weekdays row */}
      <div className="grid grid-cols-7 text-center pt-3 pb-1 text-[11px] font-medium text-mute uppercase tracking-wider">
        {DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 pt-1">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - startDay + 1;
          const isCurrentMonth = dayNum > 0 && dayNum <= daysInMonth;

          if (!isCurrentMonth) {
            return <div key={idx} className="h-10" />;
          }

          const dayStr = String(dayNum).padStart(2, "0");
          const monthStr = String(month + 1).padStart(2, "0");
          const dateIso = `${year}-${monthStr}-${dayStr}`;

          const isSelected = dateIso === selectedDate;
          const isAvailable = dateIso >= minDate && dateIso <= maxDate;

          return (
            <button
              key={dateIso}
              type="button"
              disabled={!isAvailable}
              onClick={() => onSelectDate(dateIso)}
              className={`h-10 rounded-xl font-mono text-xs font-medium transition flex items-center justify-center ${
                isSelected
                  ? "bg-ink text-white font-semibold shadow-sm"
                  : isAvailable
                  ? "border border-line bg-zinc-50/60 text-ink hover:border-ink hover:bg-white cursor-pointer"
                  : "text-zinc-300 cursor-not-allowed bg-transparent"
              }`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
