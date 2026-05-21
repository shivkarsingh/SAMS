import { useEffect, useMemo, useState } from "react";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const scheduleDayIndexes = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};
const classColorPalette = [
  {
    accent: "#38bdf8",
    background: "rgba(56, 189, 248, 0.13)",
    border: "rgba(56, 189, 248, 0.34)"
  },
  {
    accent: "#34d399",
    background: "rgba(52, 211, 153, 0.13)",
    border: "rgba(52, 211, 153, 0.34)"
  },
  {
    accent: "#f59e0b",
    background: "rgba(245, 158, 11, 0.13)",
    border: "rgba(245, 158, 11, 0.34)"
  },
  {
    accent: "#a78bfa",
    background: "rgba(167, 139, 250, 0.14)",
    border: "rgba(167, 139, 250, 0.34)"
  },
  {
    accent: "#22c55e",
    background: "rgba(34, 197, 94, 0.13)",
    border: "rgba(34, 197, 94, 0.34)"
  },
  {
    accent: "#fb7185",
    background: "rgba(251, 113, 133, 0.13)",
    border: "rgba(251, 113, 133, 0.34)"
  },
  {
    accent: "#eab308",
    background: "rgba(234, 179, 8, 0.13)",
    border: "rgba(234, 179, 8, 0.34)"
  },
  {
    accent: "#2dd4bf",
    background: "rgba(45, 212, 191, 0.13)",
    border: "rgba(45, 212, 191, 0.34)"
  }
];
const classStatusColors = {
  taken: {
    accent: "#22c55e",
    background: "rgba(34, 197, 94, 0.15)",
    border: "rgba(34, 197, 94, 0.42)"
  },
  missed: {
    accent: "#ef4444",
    background: "rgba(239, 68, 68, 0.14)",
    border: "rgba(239, 68, 68, 0.42)"
  },
  upcoming: {
    accent: "#38bdf8",
    background: "rgba(56, 189, 248, 0.14)",
    border: "rgba(56, 189, 248, 0.38)"
  }
};

function getLocalDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateFromDateKey(dateKey) {
  const [year, month, day] = String(dateKey ?? "")
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function getExamDate(exam) {
  if (exam.examDateKey) {
    return getDateFromDateKey(exam.examDateKey);
  }

  const examDate = new Date(exam.examDate);

  return Number.isFinite(examDate.getTime()) ? examDate : null;
}

function getMonthStart(value) {
  const date = new Date(value);

  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(value, offset) {
  return new Date(value.getFullYear(), value.getMonth() + offset, 1);
}

function getCalendarStartDate(exams, startOnCurrentMonth) {
  if (startOnCurrentMonth) {
    return getMonthStart(new Date());
  }

  return getMonthStart(exams.map(getExamDate).find(Boolean) ?? new Date());
}

function getMonthLabel(value) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric"
  }).format(value);
}

function getMonthDays(activeDate) {
  const firstDay = new Date(activeDate.getFullYear(), activeDate.getMonth(), 1);
  const lastDay = new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 0);
  const days = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    days.push({
      key: `empty-${index}`,
      empty: true
    });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(activeDate.getFullYear(), activeDate.getMonth(), day);

    days.push({
      key: getLocalDateKey(date),
      day,
      dateKey: getLocalDateKey(date),
      dayIndex: date.getDay()
    });
  }

  return days;
}

function getClassColor(index) {
  return classColorPalette[index % classColorPalette.length];
}

function timeToMinutes(value) {
  const match = String(value ?? "").trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return Number.NaN;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function getSlotTimeLabel(slot) {
  if (slot.timeLabel) {
    return slot.timeLabel;
  }

  if (slot.startTime && slot.endTime) {
    return `${slot.startTime} - ${slot.endTime}`;
  }

  return slot.startTime || "Time TBD";
}

function getClassEventStatus(day, slot, course, now) {
  const takenDateKeys = new Set(
    course.attendanceDateKeys ?? course.classTakenDateKeys ?? []
  );
  const cancelledDateKeys = new Set(course.cancelledDateKeys ?? []);

  if (takenDateKeys.has(day.dateKey)) {
    return {
      tone: "taken",
      label: "Taken"
    };
  }

  if (cancelledDateKeys.has(day.dateKey)) {
    return {
      tone: "missed",
      label: "Cancelled"
    };
  }

  const todayKey = getLocalDateKey(now);

  if (day.dateKey > todayKey) {
    return {
      tone: "upcoming",
      label: "Upcoming"
    };
  }

  if (day.dateKey === todayKey) {
    const startMinutes = timeToMinutes(slot.startTime);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (!Number.isFinite(startMinutes) || startMinutes > currentMinutes) {
      return {
        tone: "upcoming",
        label: "Upcoming"
      };
    }
  }

  return {
    tone: "missed",
    label: "Not Taken"
  };
}

function buildClassEventsForDay(
  day,
  classes = [],
  { showClassAttendanceStatus = false, now = new Date() } = {}
) {
  return classes.flatMap((course, courseIndex) => {
    const color = getClassColor(courseIndex);

    return (course.scheduleSlots ?? [])
      .filter((slot) => scheduleDayIndexes[slot.day] === day.dayIndex)
      .map((slot) => {
        const status = showClassAttendanceStatus
          ? getClassEventStatus(day, slot, course, now)
          : null;
        const eventColor = status ? classStatusColors[status.tone] : color;

        return {
          id: `class-${course.id}-${day.dateKey}-${slot.startTime}-${slot.endTime}`,
          type: "class",
          className: course.title ?? course.subjectName ?? course.code ?? "Class",
          semesterLabel: course.semesterLabel || "Semester TBD",
          room: course.room || "Classroom TBD",
          timeLabel: getSlotTimeLabel(slot),
          status: status?.tone ?? "",
          statusLabel: status?.label ?? "",
          startTime: slot.startTime,
          endTime: slot.endTime,
          sortKey: `1-${slot.startTime}`,
          style: {
            "--event-accent": eventColor.accent,
            "--event-bg": eventColor.background,
            "--event-border": eventColor.border
          }
        };
      });
  });
}

function buildExamEventsByDate(exams = []) {
  return exams.reduce((eventsByDate, exam) => {
    const dateKey = exam.examDateKey ?? getLocalDateKey(exam.examDate);
    const dateExams = eventsByDate.get(dateKey) ?? [];

    dateExams.push({
      id: `exam-${exam.id}`,
      type: "exam",
      exam,
      subjectCode: exam.subjectCode || "Code TBD",
      subjectName: exam.subjectName || exam.title || "Exam",
      semesterLabel: exam.semesterLabel || "Semester TBD",
      title: exam.title,
      sortKey: "0-exam"
    });
    eventsByDate.set(dateKey, dateExams);

    return eventsByDate;
  }, new Map());
}

function CalendarEvent({ event, onExamClick }) {
  const eventTitle =
    event.type === "exam"
      ? `${event.semesterLabel} ${event.subjectName} ${event.subjectCode}`
      : [
          event.className,
          event.timeLabel,
          event.semesterLabel,
          event.room,
          event.statusLabel
        ]
          .filter(Boolean)
          .join(", ");

  if (event.type === "exam") {
    const content = (
      <>
        <b aria-hidden="true">{"\u2605"}</b>
        <div>
          <small>{event.semesterLabel}</small>
          <p>{event.subjectName}</p>
          <small>{event.subjectCode}</small>
        </div>
      </>
    );

    if (onExamClick) {
      return (
        <button
          className="exam-calendar-event exam-calendar-exam-event"
          type="button"
          title={eventTitle}
          onClick={() => onExamClick(event.exam)}
        >
          {content}
        </button>
      );
    }

    return (
      <div
        className="exam-calendar-event exam-calendar-exam-event"
        title={eventTitle}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`exam-calendar-event exam-calendar-class-event ${
        event.status ? `exam-calendar-class-event-${event.status}` : ""
      }`}
      style={event.style}
      title={eventTitle}
    >
      <p>{event.className}</p>
      <small>{event.timeLabel}</small>
      <small>{event.semesterLabel}</small>
      <small>{event.room}</small>
      {event.statusLabel ? (
        <small className="exam-calendar-event-status">{event.statusLabel}</small>
      ) : null}
    </div>
  );
}

export function ExamCalendar({
  exams = [],
  classes = [],
  onExamClick = null,
  showClassAttendanceStatus = false,
  startOnCurrentMonth = false
}) {
  const calendarSeed = useMemo(
    () =>
      startOnCurrentMonth
        ? "current-month"
        : exams
            .map((exam) => exam.examDateKey ?? exam.examDate ?? exam.id)
            .join("|"),
    [exams, startOnCurrentMonth]
  );
  const calendarStartDate = useMemo(
    () => getCalendarStartDate(exams, startOnCurrentMonth),
    [calendarSeed, exams, startOnCurrentMonth]
  );
  const [activeDate, setActiveDate] = useState(calendarStartDate);
  const calendarNow = new Date();
  const monthDays = getMonthDays(activeDate);
  const examEventsByDate = buildExamEventsByDate(exams);

  useEffect(() => {
    setActiveDate(calendarStartDate);
  }, [calendarStartDate]);

  function handleMonthChange(offset) {
    setActiveDate((currentDate) => shiftMonth(currentDate, offset));
  }

  function handleCurrentMonth() {
    setActiveDate(getMonthStart(new Date()));
  }

  return (
    <div className="exam-calendar" aria-label="Upcoming exams and classes calendar">
      <div className="exam-calendar-header">
        <div className="exam-calendar-title">
          <strong>{getMonthLabel(activeDate)}</strong>
          <span>
            {exams.length} exam{exams.length === 1 ? "" : "s"}
            {classes.length ? ` • ${classes.length} class${classes.length === 1 ? "" : "es"}` : ""}
          </span>
        </div>
        <div className="exam-calendar-controls" aria-label="Calendar month controls">
          <button
            type="button"
            aria-label="Previous month"
            title="Previous month"
            onClick={() => handleMonthChange(-1)}
          >
            {"\u2039"}
          </button>
          <button
            className="exam-calendar-today-button"
            type="button"
            aria-label="Current month"
            title="Current month"
            onClick={handleCurrentMonth}
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            title="Next month"
            onClick={() => handleMonthChange(1)}
          >
            {"\u203a"}
          </button>
        </div>
      </div>

      <div className="exam-calendar-grid">
        {weekdayLabels.map((day) => (
          <span key={day} className="exam-calendar-weekday">
            {day}
          </span>
        ))}

        {monthDays.map((day) => {
          const dayExamEvents = day.empty ? [] : examEventsByDate.get(day.dateKey) ?? [];
          const dayClassEvents = day.empty
            ? []
            : buildClassEventsForDay(day, classes, {
                showClassAttendanceStatus,
                now: calendarNow
              });
          const dayClassStatus = dayClassEvents.some(
            (event) => event.status === "missed"
          )
            ? "missed"
            : dayClassEvents.some((event) => event.status === "taken")
              ? "taken"
              : dayClassEvents.some((event) => event.status === "upcoming")
                ? "upcoming"
                : "";
          const dayEvents = [...dayExamEvents, ...dayClassEvents].sort((left, right) =>
            left.sortKey.localeCompare(right.sortKey)
          );

          return (
            <div
              key={day.key}
              className={`exam-calendar-day ${day.empty ? "empty" : ""} ${
                dayExamEvents.length ? "has-exam" : ""
              } ${
                dayClassEvents.length ? "has-class" : ""
              } ${
                dayClassStatus ? `has-class-${dayClassStatus}` : ""
              }`}
            >
              {day.empty ? null : (
                <>
                  <strong className="exam-calendar-date-number">{day.day}</strong>
                  {dayEvents.map((event) => (
                    <CalendarEvent
                      key={event.id}
                      event={event}
                      onExamClick={onExamClick}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
