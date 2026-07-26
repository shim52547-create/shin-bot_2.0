const { getCalendarInfo } = require("../utils/lunar");

function buildMessage(info) {
  const { solar, lunarText, dayCanChi, yearCanChi, zodiac } = info;
  return (
    `╭─── 🗓️ LỊCH VẠN NIÊN ───╮\n\n` +
    `☀️ Dương lịch: ${solar.day}/${solar.month}/${solar.year} (${solar.weekday})\n` +
    `🌙 Âm lịch: ${lunarText}\n\n` +
    `📿 Ngày (Can Chi): ${dayCanChi}\n` +
    `📿 Năm (Can Chi): ${yearCanChi} - Tuổi ${zodiac}\n\n` +
    `╰────────────────────╯`
  );
}

// Chấp nhận dd/mm/yyyy, dd-mm-yyyy, dd/mm (mặc định năm hiện tại)
function parseDate(str) {
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
  if (year < 100) year += 2000;

  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;

  return { day, month, year };
}

module.exports = {
  config: {
    name: "lich",
    aliases: ["lichvannien", "amlich"],
    version: "1.0",
    role: 0,
    description: "Xem lịch vạn niên (dương lịch + âm lịch) hôm nay hoặc 1 ngày bất kỳ",
    usage: "lich | lich <dd/mm/yyyy>",
    category: "Tiện ích"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    let target;
    if (!args[0]) {
      const now = new Date();
      target = { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
    } else {
      target = parseDate(args[0]);
      if (!target) {
        return api.sendMessage(
          "⚠️ Ngày không hợp lệ.\nCách dùng: lich hoặc lich <dd/mm/yyyy>\nVí dụ: lich 15/8/2003",
          threadID, messageID
        );
      }
    }

    try {
      const info = getCalendarInfo(target.day, target.month, target.year);
      return api.sendMessage(buildMessage(info), threadID, messageID);
    } catch (e) {
      return api.sendMessage("❌ Không thể tính lịch cho ngày này, vui lòng thử ngày khác.", threadID, messageID);
    }
  }
};
