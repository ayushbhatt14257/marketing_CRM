// All "today" boundaries are computed in IST (Asia/Kolkata), per project requirement,
// regardless of the server's own timezone (Render runs UTC by default).

const IST_OFFSET_MINUTES = 5 * 60 + 30;

function toIST(date) {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + IST_OFFSET_MINUTES * 60000);
}

function startOfTodayIST() {
  const nowIST = toIST(new Date());
  nowIST.setHours(0, 0, 0, 0);
  // Convert back to a real UTC instant representing IST midnight
  return new Date(nowIST.getTime() - IST_OFFSET_MINUTES * 60000);
}

function endOfTodayIST() {
  const start = startOfTodayIST();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function startOfWeekIST() {
  const start = startOfTodayIST();
  const dayOfWeek = toIST(start).getDay(); // 0 = Sunday
  const diff = (dayOfWeek + 6) % 7; // Monday-start week
  return new Date(start.getTime() - diff * 24 * 60 * 60 * 1000);
}

function startOfMonthIST() {
  const nowIST = toIST(new Date());
  const firstOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
  return new Date(firstOfMonth.getTime() - IST_OFFSET_MINUTES * 60000);
}

module.exports = { toIST, startOfTodayIST, endOfTodayIST, startOfWeekIST, startOfMonthIST };
