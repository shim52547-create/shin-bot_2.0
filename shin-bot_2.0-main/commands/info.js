module.exports = {
  config: {
    name: "info",
    aliases: ["about"],
    version: "1.0",
    role: 0,
    description: "Thông tin về bot",
    usage: "info",
    category: "Hệ thống"
  },
  run: async ({ api, event }) => {
    const msg =
      `🤖 ${global.config.BOT_NAME}\n` +
      `Số lệnh: ${global.client.commands.size}\n` +
      `Prefix mặc định: ${global.config.PREFIX}\n` +
      `Node.js: ${process.version}\n` +
      `Nền tảng: @dongdev/fca-unofficial`;
    return api.sendMessage(msg, event.threadID, event.messageID);
  }
};
