const { Currencies } = require("../utils/currency");

const PERIODS = {
  "ngay": { key: "day", label: "hôm nay" },
  "today": { key: "day", label: "hôm nay" },
  "tuan": { key: "week", label: "tuần này" },
  "week": { key: "week", label: "tuần này" },
  "thang": { key: "month", label: "tháng này" },
  "month": { key: "month", label: "tháng này" },
  "all": { key: "all", label: "toàn thời gian" },
  "tatca": { key: "all", label: "toàn thời gian" }
};

// Bỏ dấu tiếng Việt để args gõ có dấu/không dấu đều nhận được (vd: "tuần" -> "tuan")
function stripAccents(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

const MEDAL = ["🥇", "🥈", "🥉"];

module.exports = {
  config: {
    name: "topcoins",
    aliases: ["topxu", "bxh"],
    version: "1.0",
    role: 0,
    description: "Bảng xếp hạng xu ảo theo ngày / tuần / tháng / toàn thời gian",
    usage: "topcoins [ngay|tuan|thang|all]",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const key = stripAccents(args[0] || "all");
    const period = PERIODS[key];

    if (!period) {
      return api.sendMessage(
        `⚠️ Tham số không hợp lệ.\nCách dùng: topcoins [ngay|tuan|thang|all]`,
        threadID,
        messageID
      );
    }

    const top = Currencies.getTop(period.key === "all" ? null : period.key, 10);

    if (!top.length) {
      return api.sendMessage(`📊 Chưa có dữ liệu xếp hạng cho mốc thời gian: ${period.label}.`, threadID, messageID);
    }

    let userInfo = {};
    try {
      userInfo = await api.getUserInfo(top.map(t => t.userID));
    } catch (e) {
      userInfo = {};
    }

    const titleLine = period.key === "all"
      ? "💰 TOP SỐ DƯ XU (toàn thời gian)"
      : `💰 TOP KIẾM XU NHIỀU NHẤT — ${period.label}`;

    let msg = `${titleLine}\n\n`;
    top.forEach((entry, i) => {
      const name = userInfo[entry.userID]?.name || `UID ${entry.userID}`;
      const rankIcon = MEDAL[i] || `${i + 1}.`;
      const amountLabel = period.key === "all"
        ? `${entry.amount} xu`
        : `${entry.amount > 0 ? "+" : ""}${entry.amount} xu`;
      msg += `${rankIcon} ${name} — ${amountLabel}\n`;
    });

    return api.sendMessage(msg.trim(), threadID, messageID);
  }
};
