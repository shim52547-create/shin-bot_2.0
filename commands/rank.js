const { Ranks } = require("../utils/rank");
const { generateRankCard } = require("../utils/rankCard");

module.exports = {
  config: {
    name: "rank",
    aliases: ["level", "lv"],
    version: "2.0",
    role: 0,
    description: "Xem rank & EXP hiện tại dưới dạng thẻ ảnh (tag/reply để xem người khác)",
    usage: "rank (tag/reply người khác để xem rank của họ)",
    category: "Kinh tế"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID, mentions, messageReply } = event;

    let targetID = senderID;
    if (messageReply) targetID = messageReply.senderID;
    else if (mentions && Object.keys(mentions).length > 0) targetID = Object.keys(mentions)[0];

    const data = Ranks.getData(targetID);
    const current = Ranks.getCurrentRank(targetID);
    const next = Ranks.getNextRank(targetID);
    const levelInfo = Ranks.getLevelInfo(targetID);

    let targetName = "Người dùng";
    try {
      const info = await api.getUserInfo(targetID);
      targetName = info?.[targetID]?.name || targetName;
    } catch (e) { /* bỏ qua, dùng tên mặc định */ }

    const avatarURL = `https://graph.facebook.com/${targetID}/picture?width=720&height=720&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;

    try {
      const buffer = await generateRankCard({
        name: targetName,
        uid: targetID,
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
      imgStream.path = `rank_${targetID}.png`;

      return api.sendMessage({ attachment: imgStream }, threadID, messageID);
    } catch (e) {
      console.error("[rank] Lỗi tạo ảnh rank card, dùng bản text dự phòng:", e);

      let progressLine;
      if (next) {
        const remaining = Math.max(0, next.minExp - data.exp);
        const eligible = data.exp >= next.minExp;
        progressLine = eligible
          ? `✅ Đã đủ EXP để lên ${next.emoji} ${next.name}! Gõ "rankup" để nhận rank mới.`
          : `📈 Còn thiếu ${remaining} EXP để đủ điều kiện lên ${next.emoji} ${next.name}.`;
      } else {
        progressLine = "🏆 Bạn đã đạt rank cao nhất!";
      }

      const body =
        `${current.emoji} RANK CỦA ${targetName.toUpperCase()}\n` +
        `——————————————\n` +
        `🎖️ Rank hiện tại: ${current.emoji} ${current.name}\n` +
        `✨ Tổng EXP: ${data.exp}\n` +
        `📊 Level: ${levelInfo.level} (${levelInfo.levelExpInto}/${levelInfo.levelExpNeeded} EXP)\n` +
        `${progressLine}`;

      return api.sendMessage(body, threadID, messageID);
    }
  }
};
