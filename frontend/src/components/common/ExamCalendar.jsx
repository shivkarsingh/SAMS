const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getLocalDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
      dateKey: getLocalDateKey(date)
    });
  }

  return days;
}

export function ExamCalendar({ exams = [] }) {
  const firstExamDate = exams[0]?.examDate ? new Date(exams[0].examDate) : new Date();
  const monthDays = getMonthDays(firstExamDate);
  const examsByDate = new Map();

  exams.forEach((exam) => {
    const dateKey = exam.examDateKey ?? getLocalDateKey(exam.examDate);
    const dateExams = examsByDate.get(dateKey) ?? [];
    dateExams.push(exam);
    examsByDate.set(dateKey, dateExams);
  });

  return (
    <div className="exam-calendar" aria-label="Upcoming exam calendar">
      <div className="exam-calendar-header">
        <strong>{getMonthLabel(firstExamDate)}</strong>
        <span>{exams.length} exam{exams.length === 1 ? "" : "s"}</span>
      </div>

      <div className="exam-calendar-grid">
        {weekdayLabels.map((day) => (
          <span key={day} className="exam-calendar-weekday">
            {day}
          </span>
        ))}

        {monthDays.map((day) => {
          const dateExams = day.empty ? [] : examsByDate.get(day.dateKey) ?? [];

          return (
            <div
              key={day.key}
              className={`exam-calendar-day ${day.empty ? "empty" : ""} ${
                dateExams.length ? "has-exam" : ""
              }`}
            >
              {day.empty ? null : (
                <>
                  <strong>{day.day}</strong>
                  {dateExams.slice(0, 2).map((exam) => (
                    <span key={exam.id}>{exam.subjectCode || exam.title}</span>
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
