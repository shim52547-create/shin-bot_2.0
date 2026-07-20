module.exports = {
  config: {
    name: "boxname",
    aliases: [],
    version: "1.0",
    role: 1,
    description: "Đổi tên nhóm",
    usage: "boxname <tên mới>",
    category: "Box chat"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const name = args.join(" ");
    if (!name) return api.sendMessage("❌ Bạn chưa nhập tên nhóm muốn đổi", threadID, messageID);
    try {
      await api.setTitle(name, threadID);
      return api.sendMessage(`🔨 Bot đã đổi tên nhóm thành: ${name}`, threadID, messageID);
    } catch (e) {
      return api.sendMessage("❌ Đổi tên thất bại — bot cần quyền quản trị viên nhóm.", threadID, messageID);
    }
  }
};
