module.exports = {
  config: {
    name: "restart",
    aliases: [],
    version: "1.0",
    role: 2,
    description: "Khởi động lại bot",
    usage: "restart",
    category: "Hệ thống"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID } = event;
    return api.sendMessage("♻️ Đang khởi động lại bot...", threadID, () => process.exit(1), messageID);
  }
};
