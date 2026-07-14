const { Threads } = require("../utils/database");

module.exports = {
  config: {
    name: "prefix",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Xem hoặc đổi prefix của nhóm (đổi cần quyền quản trị viên)",
    usage: "prefix [ký tự mới]",
    category: "Hệ thống"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const threadData = Threads.get(threadID);
    const currentPrefix = threadData.prefix || global.config.PREFIX;

    if (!args[0]) {
      return api.sendMessage(`ℹ️ Prefix hiện tại của nhóm này: "${currentPrefix}"`, threadID, messageID);
    }

    const threadInfo = await api.getThreadInfo(threadID).catch(() => null);
    const isGroupAdmin =
      threadInfo?.adminIDs?.some(a => a.id === senderID) ||
      global.config.ADMIN_BOT.includes(senderID);
    if (!isGroupAdmin) {
      return api.sendMessage("⛔ Chỉ quản trị viên nhóm mới được đổi prefix.", threadID, messageID);
    }

    const newPrefix = args[0].slice(0, 5);
    Threads.set(threadID, { prefix: newPrefix });
    return api.sendMessage(`✅ Đã đổi prefix nhóm này thành: "${newPrefix}"`, threadID, messageID);
  }
};
