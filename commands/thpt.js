const moment = require("moment-timezone");

// Ngày thi tốt nghiệp THPT 2027 (dự kiến theo Bộ GD&ĐT, có thể điều chỉnh - Bộ thường
// công bố lịch thi chính thức khoảng tháng 1-3 hàng năm, nên cập nhật lại khi có thông báo mới)
const EXAM_DATE = "2027-06-12 07:00:00";

module.exports = {
  config: {
    name: "thpt",
    version: "1.0.2",
    role: 0,
    description: "Đếm ngược tới kỳ thi tốt nghiệp THPT Quốc Gia",
    usage: "thpt",
    category: "Khác"
  },
  run: async ({ api, event }) => {
    const now = moment().tz("Asia/Ho_Chi_Minh");
    const examDate = moment.tz(EXAM_DATE, "Asia/Ho_Chi_Minh");

    if (examDate.isBefore(now)) {
      return api.sendMessage(
        "⚠️ Chưa có thông tin lịch thi THPT Quốc Gia cho kỳ thi kế tiếp. Vui lòng cập nhật ngày thi mới trong lệnh này.",
        event.threadID, event.messageID
      );
    }

    const dur = moment.duration(examDate.diff(now));
    const msg =
      `「⏳ Đếm ngược tới kỳ thi THPT Quốc Gia」\n` +
      `» Ngày thi (dự kiến): ${examDate.format("DD/MM/YYYY HH:mm")}\n` +
      `» Còn lại: ${Math.floor(dur.asDays())} ngày ${dur.hours()} giờ ${dur.minutes()} phút ${dur.seconds()} giây «`;

    return api.sendMessage(msg, event.threadID, event.messageID);
  }
};
