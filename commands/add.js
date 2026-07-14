module.exports = {
  config: {
    name: "add",
    aliases: [],
    version: "1.0",
    role: 1,
    description: "Thêm người vào nhóm bằng UID Facebook",
    usage: "add <uid>",
    category: "Quản trị nhóm"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const uid = args[0];

    if (!uid || !/^\d+$/.test(uid)) {
      return api.sendMessage("⚠️ Vui lòng nhập UID hợp lệ.\nCách dùng: add <uid>", threadID, messageID);
    }

    try {
      await api.addUserToGroup(uid, threadID);
      return api.sendMessage("✅ Đã gửi lời mời/thêm người dùng vào nhóm.", threadID, messageID);
    } catch (err) {
      return api.sendMessage("❌ Không thể thêm (UID sai, người đó đã ở trong nhóm, hoặc chặn thêm vào nhóm).", threadID, messageID);
    }
  }
};
