const { Threads } = require("../utils/database");

module.exports = {
  config: {
    name: "rules",
    aliases: ["noiquy"],
    version: "1.0",
    role: 0,
    description: "Xem nội quy nhóm; QTV có thể đặt nội quy mới",
    usage: "rules [nội quy mới - chỉ QTV]",
    category: "Quản trị nhóm"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const threadData = Threads.get(threadID);

    if (!args[0]) {
      return api.sendMessage(threadData.rules ? `📜 Nội quy nhóm:\n${threadData.rules}` : "📜 Nhóm này chưa có nội quy.", threadID, messageID);
    }

    const threadInfo = await api.getThreadInfo(threadID).catch(() => null);
    const isGroupAdmin =
      threadInfo?.adminIDs?.some(a => a.id === senderID) ||
      global.config.ADMIN_BOT.includes(senderID);
    if (!isGroupAdmin) {
      return api.sendMessage("⛔ Chỉ quản trị viên nhóm mới được đặt nội quy.", threadID, messageID);
    }

    const rules = args.join(" ");
    Threads.set(threadID, { rules });
    return api.sendMessage("✅ Đã cập nhật nội quy nhóm.", threadID, messageID);
  }
};
