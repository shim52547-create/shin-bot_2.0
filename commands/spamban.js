const { AntiSpam } = require("../utils/antiSpam");

module.exports = {
  config: {
    name: "spamban",
    version: "2.1.0",
    role: 0,
    description: `Tự động cấm người dùng nếu spam bot ${AntiSpam.NUM} lần/${AntiSpam.TIME}s`,
    usage: "spamban",
    category: "Hệ thống"
  },
  run: async ({ api, event }) => {
    return api.sendMessage(
      `⚡ Tự động cấm người dùng nếu spam ${AntiSpam.NUM} lần/${AntiSpam.TIME}s`,
      event.threadID, event.messageID
    );
  }
};
