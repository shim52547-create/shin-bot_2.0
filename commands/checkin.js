const { Currencies } = require("../utils/currency");

const BASE_REWARD = 100;
const BONUS_PER_STREAK_DAY = 20; // mỗi ngày liên tiếp thêm 20 xu, tối đa ở mốc MAX_STREAK_BONUS
const MAX_STREAK_BONUS_DAYS = 10; // sau 10 ngày liên tiếp thì bonus không tăng thêm nữa
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

module.exports = {
  config: {
    name: "checkin",
    aliases: ["diemdanhchuoi"],
    version: "1.0",
    role: 0,
    description: "Điểm danh mỗi ngày, giữ chuỗi (streak) liên tiếp để nhận thưởng ngày càng cao",
    usage: "checkin",
    category: "Giải trí"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID } = event;
    const data = Currencies.getData(senderID);
    const now = Date.now();
    const today = startOfDay(now);
    const lastCheckin = data.lastCheckinDay || 0;

    if (lastCheckin === today) {
      return api.sendMessage("⏳ Bạn đã điểm danh hôm nay rồi, quay lại vào ngày mai nhé!", threadID, messageID);
    }

    const brokeStreak = lastCheckin !== today - DAY_MS;
    const newStreak = brokeStreak ? 1 : (data.checkinStreak || 0) + 1;

    const bonusDays = Math.min(newStreak - 1, MAX_STREAK_BONUS_DAYS);
    const reward = BASE_REWARD + bonusDays * BONUS_PER_STREAK_DAY;

    Currencies.setData(senderID, { lastCheckinDay: today, checkinStreak: newStreak });
    const newBalance = Currencies.increaseMoney(senderID, reward);

    let note = "";
    if (brokeStreak && lastCheckin !== 0) note = "\n⚠️ Chuỗi ngày liên tiếp trước đó đã bị đứt, bắt đầu lại từ đầu.";

    return api.sendMessage(
      `✅ Điểm danh thành công!\n🔥 Chuỗi liên tiếp: ${newStreak} ngày\n🎁 Nhận: ${reward} xu (số dư: ${newBalance})${note}`,
      threadID, messageID
    );
  }
};
