module.exports = {
  config: {
    name: "avatar",
    aliases: ["avt"],
    version: "1.0",
    role: 0,
    description: "Lấy ảnh đại diện Facebook của bản thân hoặc người được tag/reply",
    usage: "avatar (tag/reply người khác để lấy ảnh của họ)",
    category: "Tiện ích"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID, messageReply, mentions } = event;
    let targetID = senderID;

    if (messageReply) targetID = messageReply.senderID;
    else if (mentions && Object.keys(mentions).length > 0) targetID = Object.keys(mentions)[0];

    const url = `https://graph.facebook.com/${targetID}/picture?width=720&height=720&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;
    return api.sendMessage({ body: "🖼️ Ảnh đại diện:", attachment: await global.utils?.getStreamFromURL?.(url) }, threadID, messageID)
      .catch(() => api.sendMessage(`🖼️ Ảnh đại diện: ${url}`, threadID, messageID));
  }
};
