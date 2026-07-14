module.exports = {
  config: {
    name: "kick",
    aliases: [],
    version: "1.0",
    role: 1,
    description: "Kick thành viên khỏi nhóm (tag hoặc reply người cần kick)",
    usage: "kick (tag hoặc reply người cần kick)",
    category: "Quản trị nhóm"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, messageReply, mentions } = event;
    let targetID = messageReply?.senderID || Object.keys(mentions || {})[0];

    if (!targetID) {
      return api.sendMessage("⚠️ Hãy tag hoặc reply người bạn muốn kick.", threadID, messageID);
    }

    try {
      await api.removeUserFromGroup(targetID, threadID);
      return api.sendMessage("✅ Đã kick thành viên khỏi nhóm.", threadID, messageID);
    } catch (err) {
      return api.sendMessage("❌ Không thể kick (có thể bot không phải QTV, hoặc người đó là QTV nhóm).", threadID, messageID);
    }
  }
};
