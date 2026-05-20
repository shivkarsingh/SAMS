export const scheduleDays = [
  { id: "mon", label: "Monday", shortLabel: "Mon", index: 1, order: 0 },
  { id: "tue", label: "Tuesday", shortLabel: "Tue", index: 2, order: 1 },
  { id: "wed", label: "Wednesday", shortLabel: "Wed", index: 3, order: 2 },
  { id: "thu", label: "Thursday", shortLabel: "Thu", index: 4, order: 3 },
  { id: "fri", label: "Friday", shortLabel: "Fri", index: 5, order: 4 },
  { id: "sat", label: "Saturday", shortLabel: "Sat", index: 6, order: 5 },
  { id: "sun", label: "Sunday", shortLabel: "Sun", index: 0, order: 6 }
];

const scheduleDayById = new Map(scheduleDays.map((day) => [day.id, day]));
const scheduleDayByDateIndex = new Map(scheduleDays.map((day) => [day.index, day]));
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeDayId(value) {
  const normalizedValue = String(value ?? "").trim().toLowerCase();
  const aliases = {
    monday: "mon",
    m: "mon",
    tuesday: "tue",
    t: "tue",
    wednesday: "wed",
    w: "wed",
    thursday: "thu",
    th: "thu",
    friday: "fri",
    f: "fri",
    saturday: "sat",
    s: "sat",
    sunday: "sun",
    su: "sun"
  };

  return scheduleDayById.has(normalizedValue)
    ? normalizedValue
    : aliases[normalizedValue];
}

export function getCurrentScheduleDayId(date = new Date()) {
  return scheduleDayByDateIndex.get(date.getDay())?.id ?? "mon";
}

export function getScheduleDayMeta(dayId) {
  return scheduleDayById.get(dayId) ?? null;
}

export function isValidScheduleTime(value) {
  return timePattern.test(String(value ?? "").trim());
}

export function timeToMinutes(value) {
  const match = String(value ?? "").trim().match(timePattern);

  if (!match) {
    return Number.NaN;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatTimeLabel(value) {
  const minutes = timeToMinutes(value);

  if (!Number.isFinite(minutes)) {
    return "Time TBD";
  }

  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function formatSlotTime(slot) {
  return `${formatTimeLabel(slot.startTime)} - ${formatTimeLabel(slot.endTime)}`;
}

export function sanitizeScheduleSlots(scheduleSlots = []) {
  if (!Array.isArray(scheduleSlots)) {
    return [];
  }

  return scheduleSlots
    .map((slot) => {
      const day = normalizeDayId(slot?.day);
      const startTime = String(slot?.startTime ?? "").trim();
      const endTime = String(slot?.endTime ?? "").trim();
      const dayMeta = getScheduleDayMeta(day);

      if (
        !dayMeta ||
        !isValidScheduleTime(startTime) ||
        !isValidScheduleTime(endTime) ||
        timeToMinutes(endTime) <= timeToMinutes(startTime)
      ) {
        return null;
      }

      return {
        day,
        dayLabel: dayMeta.label,
        shortDayLabel: dayMeta.shortLabel,
        startTime,
        endTime,
        timeLabel: formatSlotTime({ startTime, endTime }),
        sortKey: dayMeta.order * 1440 + timeToMinutes(startTime)
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sortKey - right.sortKey);
}

export function normalizeScheduleSlots(scheduleSlots = []) {
  if (!Array.isArray(scheduleSlots)) {
    return [];
  }

  const normalizedSlots = [];
  const seenSlots = new Set();

  scheduleSlots.forEach((slot) => {
    const days = Array.isArray(slot?.days) ? slot.days : [slot?.day];
    const startTime = String(slot?.startTime ?? "").trim();
    const endTime = String(slot?.endTime ?? "").trim();

    if (!days.filter(Boolean).length && !startTime && !endTime) {
      return;
    }

    if (!isValidScheduleTime(startTime) || !isValidScheduleTime(endTime)) {
      throw new Error("Add a valid start and end time for each schedule slot.");
    }

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      throw new Error("Schedule end time must be after the start time.");
    }

    days.forEach((dayValue) => {
      const day = normalizeDayId(dayValue);

      if (!day) {
        throw new Error("Choose a valid day for every schedule slot.");
      }

      const slotKey = `${day}-${startTime}-${endTime}`;

      if (!seenSlots.has(slotKey)) {
        seenSlots.add(slotKey);
        normalizedSlots.push({
          day,
          startTime,
          endTime
        });
      }
    });
  });

  return sanitizeScheduleSlots(normalizedSlots).map(
    ({ day, startTime, endTime }) => ({
      day,
      startTime,
      endTime
    })
  );
}

export function summarizeScheduleSlots(scheduleSlots = [], fallback = "") {
  const sanitizedSlots = sanitizeScheduleSlots(scheduleSlots);

  if (!sanitizedSlots.length) {
    return String(fallback ?? "").trim();
  }

  const slotsByTime = new Map();

  sanitizedSlots.forEach((slot) => {
    const timeLabel = formatSlotTime(slot);
    const currentDays = slotsByTime.get(timeLabel) ?? [];
    currentDays.push(slot.shortDayLabel);
    slotsByTime.set(timeLabel, currentDays);
  });

  return Array.from(slotsByTime.entries())
    .map(([timeLabel, days]) => `${days.join(", ")} ${timeLabel}`)
    .join("; ");
}
