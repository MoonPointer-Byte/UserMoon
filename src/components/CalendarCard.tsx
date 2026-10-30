import { useState } from "react";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function buildDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: { day: number; outside: boolean }[] = [];
  for (let i = 0; i < start; i += 1) cells.push({ day: 0, outside: true });
  for (let day = 1; day <= count; day += 1) cells.push({ day, outside: false });
  return cells;
}

export function CalendarCard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const [selected, setSelected] = useState(today);
  const cells = buildDays(year, month);
  const label = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  return (
    <>
      <div className="cal__head">
        <strong>
          {year}/{String(month + 1).padStart(2, "0")}
        </strong>
        <span>{label}</span>
      </div>
      <div className="cal__week">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="cal__grid">
        {cells.map((cell, index) =>
          cell.outside ? (
            <span key={`e-${index}`} className="is-out" />
          ) : (
            <button
              key={cell.day}
              type="button"
              className={[cell.day === today ? "is-today" : "", cell.day === selected ? "is-on" : ""]
                .filter(Boolean)
                .join(" ") || undefined}
              onClick={() => setSelected(cell.day)}
            >
              {cell.day}
            </button>
          ),
        )}
      </div>
      <p className="cal__pick">
        {month + 1}月{selected}日{selected === today ? " · 今天" : ""}
      </p>
    </>
  );
}
