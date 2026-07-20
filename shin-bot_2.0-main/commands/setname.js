module.exports = {
  config: {
    name: "setname",
    aliases: ["setgroupname"],
    version: "1.0",
    role: 1,
    description: "Đổi tên của nhóm hiện tại",
    usage: "setname <tên mới>",
    category: "Quản trị nhóm"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const name = args.join(" ").trim();

    if (!name) {
      return api.sendMessage("⚠️ Vui lòng nhập tên mới.\nCách dùng: setname <tên mới>", threadID, messageID);
    }

    try {
      await api.setTitle(name, threadID);
      return api.sendMessage(`✅ Đã đổi tên nhóm thành: "${name}"`, threadID, messageID);
    } catch (err) {
      return api.sendMessage("❌ Không thể đổi tên nhóm.", threadID, messageID);
    }
  }
};
