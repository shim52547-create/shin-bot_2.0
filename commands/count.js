const { MessageCount } = require("../utils/messageCount");

const MEDAL = ["🥇", "🥈", "🥉"];

module.exports = {
  config: {
    name: "count",
    aliases: ["topcount", "topchat", "topmsg"],
    version: "1.0",
    role: 0,
    description: "Xem bảng xếp hạng nhắn tin trong ngày, hoặc đếm tin nhắn của 1 người (tag/reply)",
    usage: "count | count @tên | (reply tin nhắn của người đó rồi gõ count)",
    category: "Nhóm"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, mentions, messageReply } = event;

    // Xác định người được nhắm tới: ưu tiên reply, sau đó tới tag (@mention)
    let targetID = null;
    if (messageReply) targetID = messageReply.senderID;
    else if (mentions && Object.keys(mentions).length > 0) targetID = Object.keys(mentions)[0];

    // Trường hợp: count @tên hoặc reply -> đếm riêng người đó trong ngày
    if (targetID) {
      const count = MessageCount.getUserCount(threadID, targetID);

      let targetName = "Người dùng";
      try {
        const info = await api.getUserInfo(targetID);
        targetName = info?.[targetID]?.name || targetName;
      } catch (e) { /* bỏ qua, dùng tên mặc định */ }

      return api.sendMessage(
        `📨 ${targetName} đã nhắn ${count} tin nhắn trong hôm nay.`,
        threadID,
        messageID
      );
    }

    // Trường hợp: count (không có tham số) -> bảng xếp hạng top 10 trong ngày
    const top = MessageCount.getTop(threadID, 10);

    if (!top.length) {
      return api.sendMessage("📊 Hôm nay chưa có ai nhắn tin trong nhóm này.", threadID, messageID);
    }

    let userInfo = {};
    try {
      userInfo = await api.getUserInfo(top.map(t => t.userID));
    } catch (e) {
      userInfo = {};
    }

    let msg = `📊 TOP NHẮN TIN HÔM NAY\n——————————————\n`;
    top.forEach((entry, i) => {
      const name = userInfo[entry.userID]?.name || `UID ${entry.userID}`;
      const rankIcon = MEDAL[i] || `${i + 1}.`;
      msg += `${rankIcon} ${name} — ${entry.count} tin nhắn\n`;
    });

    return api.sendMessage(msg.trim(), threadID, messageID);
  }
};
