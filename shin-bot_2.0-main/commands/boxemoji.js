module.exports = {
  config: {
    name: "boxemoji",
    aliases: [],
    version: "1.0",
    role: 1,
    description: "Đổi emoji (biểu tượng cảm xúc) của nhóm",
    usage: "boxemoji <emoji>",
    category: "Box chat"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const emoji = args.join(" ");
    if (!emoji) return api.sendMessage("❌ Bạn chưa nhập emoji muốn đổi", threadID, messageID);
    try {
      await api.changeThreadEmoji(emoji, threadID);
      return api.sendMessage(`🔨 Bot đã đổi thành công emoji thành: ${emoji}`, threadID, messageID);
    } catch (e) {
      return api.sendMessage("❌ Đổi emoji thất bại — bot cần quyền quản trị viên nhóm hoặc emoji không hợp lệ.", threadID, messageID);
    }
  }
};
