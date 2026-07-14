const { Currencies } = require("../utils/currency");

const DAILY_AMOUNT = 200;
const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 tiếng

function formatRemaining(ms) {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} giờ ${m} phút`;
}

module.exports = {
  config: {
    name: "daily",
    aliases: ["diemdanh"],
    version: "1.0",
    role: 0,
    description: "Nhận xu ảo miễn phí, mỗi 12 tiếng nhận được 1 lần",
    usage: "daily",
    category: "Giải trí"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID } = event;
    const result = Currencies.claimDaily(senderID, DAILY_AMOUNT, COOLDOWN_MS);

    if (!result.ok) {
      return api.sendMessage(`⏳ Bạn đã nhận rồi! Còn ${formatRemaining(result.remainingMs)} nữa mới nhận lại được.`, threadID, messageID);
    }

    return api.sendMessage(`🎁 Bạn đã nhận ${DAILY_AMOUNT} xu miễn phí!\nSố dư hiện tại: ${result.money} xu.\n⏳ Quay lại sau 12 tiếng để nhận tiếp.`, threadID, messageID);
  }
};
