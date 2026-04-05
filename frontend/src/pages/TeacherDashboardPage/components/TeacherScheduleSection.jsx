import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

export function TeacherScheduleSection({ todaysSchedule, weeklySchedule }) {
  return (
    <section className="dashboard-lower-grid" id="schedule">
      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Today's Schedule"
          title="What needs your attention today."
        />

        <div className="timeline-list">
          {todaysSchedule.length ? (
            todaysSchedule.map((item) => (
              <article key={`${item.title}-${item.time}`} className="timeline-card">
                <div className="timeline-time">
                  <strong>{item.time}</strong>
                  <span>{item.attendanceStatus}</span>
                </div>
                <div className="timeline-content">
                  <h3>
                    {item.title} • {item.section}
                  </h3>
                  <p>
                    {item.room} • {item.focus}
                  </p>
                </div>
              </article>
            ))
          ) : (
            <p className="panel-fallback">
              Your teaching schedule will appear here after you create classes.
            </p>
          )}
        </div>
      </article>

      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Weekly Timetable"
          title="Your teaching week at a glance."
        />

        <div className="schedule-grid">
          {weeklySchedule.map((day) => (
            <div key={day.day} className="schedule-day-card">
              <strong>{day.day}</strong>
              <div className="schedule-pill-list">
                {day.items.map((item) => (
                  <span key={item} className="schedule-pill">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
