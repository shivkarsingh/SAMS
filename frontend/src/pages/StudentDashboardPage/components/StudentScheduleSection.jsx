import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

export function StudentScheduleSection({ upcomingClasses, weeklySchedule }) {
  return (
    <section className="dashboard-lower-grid" id="schedule">
      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Upcoming Classes"
          title="What is coming next today."
        />

        <div className="timeline-list">
          {upcomingClasses.length ? (
            upcomingClasses.map((item) => (
              <article key={`${item.title}-${item.time}`} className="timeline-card">
                <div className="timeline-time">
                  <strong>{item.time}</strong>
                  <span>{item.status}</span>
                </div>
                <div className="timeline-content">
                  <h3>{item.title}</h3>
                  <p>
                    {item.faculty} • {item.room}
                  </p>
                </div>
              </article>
            ))
          ) : (
            <p className="panel-fallback">
              Your upcoming classes will appear here after you join a classroom.
            </p>
          )}
        </div>
      </article>

      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Weekly Timetable"
          title="Your regular schedule at a glance."
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
