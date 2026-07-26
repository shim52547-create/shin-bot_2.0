module.exports = {
  config: {
    name: "uid",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Lấy UID của bản thân, người được reply hoặc mention",
    usage: "uid (tag/reply người khác để lấy UID của họ)",
    category: "Tiện ích"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID, messageReply, mentions } = event;

    if (messageReply) {
      return api.sendMessage(`🆔 UID: ${messageReply.senderID}`, threadID, messageID);
    }
    if (mentions && Object.keys(mentions).length > 0) {
      const ids = Object.keys(mentions).map(id => `🆔 ${mentions[id].replace("@", "")}: ${id}`).join("\n");
      return api.sendMessage(ids, threadID, messageID);
    }
    return api.sendMessage(`🆔 UID của bạn: ${senderID}`, threadID, messageID);
  }
};
