const moment = require("moment-timezone");

// Ngày Tết Nguyên Đán (mùng 1 âm lịch) đã được xác nhận theo lịch vạn niên
const LUNAR_NEWYEAR = {
  2024: "2024-02-10", 2025: "2025-01-29", 2026: "2026-02-17", 2027: "2027-02-06",
  2028: "2028-01-26", 2029: "2029-02-13", 2030: "2030-02-03", 2031: "2031-01-23",
  2032: "2032-02-11", 2033: "2033-01-31", 2034: "2034-02-19", 2035: "2035-02-08"
};

function fmt(target, now) {
  const dur = moment.duration(target.diff(now));
  return `${Math.floor(dur.asDays())} ngày ${dur.hours()} giờ ${dur.minutes()} phút ${dur.seconds()} giây`;
}

module.exports = {
  config: {
    name: "tet",
    aliases: ["tetam", "dnt"],
    version: "1.0.0",
    role: 0,
    description: "Đếm ngược tới Tết Dương lịch và Tết Nguyên Đán (Âm lịch)",
    usage: "tet",
    category: "Khác"
  },
  run: async ({ api, event }) => {
    const now = moment().tz("Asia/Ho_Chi_Minh");

    const duong = moment.tz(`${now.year() + 1}-01-01`, "Asia/Ho_Chi_Minh").startOf("day");

    const amYear = Object.keys(LUNAR_NEWYEAR)
      .map(Number)
      .sort((a, b) => a - b)
      .find(y => moment.tz(LUNAR_NEWYEAR[y], "Asia/Ho_Chi_Minh").endOf("day").isAfter(now));
    const am = amYear ? moment.tz(LUNAR_NEWYEAR[amYear], "Asia/Ho_Chi_Minh").startOf("day") : null;

    let msg = `「⏳ ĐẾM NGƯỢC NGÀY TẾT」\n» Tết Dương lịch (01/01/${duong.year()}): còn ${fmt(duong, now)}`;
    msg += am
      ? `\n» Tết Nguyên Đán (${am.format("DD/MM/YYYY")}): còn ${fmt(am, now)}`
      : `\n» Chưa có dữ liệu Tết Nguyên Đán cho các năm xa hơn nữa.`;

    return api.sendMessage(msg, event.threadID, event.messageID);
  }
};
