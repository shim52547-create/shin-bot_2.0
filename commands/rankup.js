const { Ranks } = require("../utils/rank");
const { Currencies } = require("../utils/currency");
const { generateRankCard } = require("../utils/rankCard");

module.exports = {
  config: {
    name: "rankup",
    aliases: ["lenrank"],
    version: "2.0",
    role: 0,
    description: "Xác nhận lên rank tiếp theo khi đã đủ EXP, nhận thưởng xu (kèm ảnh thẻ rank mới)",
    usage: "rankup",
    category: "Kinh tế"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID } = event;

    const result = Ranks.tryRankUp(senderID);

    if (!result.ok) {
      if (result.reason === "MAX_RANK") {
        return api.sendMessage("🏆 Bạn đã đạt rank cao nhất, không thể lên rank thêm nữa!", threadID, messageID);
      }
      return api.sendMessage(
        `📈 Bạn chưa đủ điều kiện lên ${result.next.emoji} ${result.next.name}.\nCòn thiếu ${result.missing} EXP nữa (chat thêm để tích lũy EXP).`,
        threadID, messageID
      );
    }

    if (result.reward > 0) {
      Currencies.increaseMoney(senderID, result.reward);
    }

    const rewardLine = result.reward > 0 ? `\n💰 Phần thưởng: +${result.reward} xu` : "";
    const caption = `🎉 Chúc mừng! Bạn đã lên rank ${result.newRank.emoji} ${result.newRank.name}!${rewardLine}`;

    // Lấy dữ liệu mới nhất (sau khi đã rankup) để vẽ thẻ.
    const data = Ranks.getData(senderID);
    const current = Ranks.getCurrentRank(senderID);
    const next = Ranks.getNextRank(senderID);
    const levelInfo = Ranks.getLevelInfo(senderID);

    let name = "Người dùng";
    try {
      const info = await api.getUserInfo(senderID);
      name = info?.[senderID]?.name || name;
    } catch (e) { /* bỏ qua, dùng tên mặc định */ }

    const avatarURL = `https://graph.facebook.com/${senderID}/picture?width=720&height=720&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;

    try {
      const buffer = await generateRankCard({
        name,
        uid: senderID,
        avatarURL,
        rank: current,
        nextRank: next,
        exp: data.exp,
        level: levelInfo.level,
        levelExpInto: levelInfo.levelExpInto,
        levelExpNeeded: levelInfo.levelExpNeeded
      });

      const { Readable } = require("stream");
      const imgStream = new Readable({
        read() {
          this.push(buffer);
          this.push(null);
        }
      });
      imgStream.path = `rankup_${senderID}.png`;

      return api.sendMessage({ body: caption, attachment: imgStream }, threadID, messageID);
    } catch (e) {
      console.error("[rankup] Lỗi tạo ảnh rank card, dùng bản text dự phòng:", e);
      return api.sendMessage(caption, threadID, messageID);
    }
  }
};
