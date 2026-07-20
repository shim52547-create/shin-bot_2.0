module.exports = {
  config: {
    name: "gid",
    aliases: ["tid"],
    version: "1.0",
    role: 0,
    description: "Lấy ID của nhóm/cuộc trò chuyện hiện tại",
    usage: "gid",
    category: "Tiện ích"
  },
  run: async ({ api, event }) => {
    return api.sendMessage(`🆔 ID nhóm/cuộc trò chuyện này: ${event.threadID}`, event.threadID, event.messageID);
  }
};
