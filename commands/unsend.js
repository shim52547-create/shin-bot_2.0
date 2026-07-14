module.exports = {
  config: {
    name: "unsend",
    version: "1.0.2",
    role: 2,
    description: "Gỡ tin nhắn của bot",
    usage: "(reply tin nhắn của bot rồi gõ unsend)",
    category: "Hệ thống"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, messageReply } = event;

    if (!messageReply) {
      return api.sendMessage("⚠️ Hãy reply tin nhắn cần gỡ.", threadID, messageID);
    }
    if (messageReply.senderID !== api.getCurrentUserID()) {
      return api.sendMessage("⚠️ Không thể gỡ tin nhắn của người khác.", threadID, messageID);
    }
    return api.unsendMessage(messageReply.messageID);
  }
};
