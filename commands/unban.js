const { Users } = require("../utils/database");

module.exports = {
  config: {
    name: "unban",
    aliases: ["unspamban"],
    version: "1.0.0",
    role: 2,
    description: "Gỡ ban cho người dùng bị hệ thống tự động cấm vì spam bot",
    usage: "unban (tag/reply người cần gỡ, hoặc unban <uid>) | unban list",
    category: "Hệ thống"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, messageReply, mentions } = event;

    // unban list -> liệt kê tất cả user đang bị auto-ban vì spam
    if ((args[0] || "").toLowerCase() === "list") {
      const all = Users.getAll();
      const banned = Object.entries(all).filter(([, data]) => data.banned);
      if (banned.length === 0) {
        return api.sendMessage("📭 Hiện không có ai đang bị cấm vì spam.", threadID, messageID);
      }
      const text = banned
        .map(([uid, data], i) => `${i + 1}. ${uid}${data.banReason ? ` - ${data.banReason}` : ""}${data.banDate ? ` (${data.banDate})` : ""}`)
        .join("\n");
      return api.sendMessage(`[ Danh sách đang bị cấm vì spam ] (${banned.length})\n${text}`, threadID, messageID);
    }

    // Xác định UID cần gỡ: reply > tag > nhập tay
    const targetID = messageReply?.senderID || Object.keys(mentions || {})[0] || args[0];

    if (!targetID) {
      return api.sendMessage(
        "⚠️ Hãy tag, reply, hoặc nhập UID người cần gỡ ban.\nCú pháp: unban <uid> | unban list",
        threadID, messageID
      );
    }
    if (!/^\d+$/.test(targetID)) {
      return api.sendMessage("⚠️ UID không hợp lệ.", threadID, messageID);
    }

    const userData = Users.get(targetID);
    if (!userData.banned) {
      return api.sendMessage(`❎ UID ${targetID} hiện không bị cấm vì spam.`, threadID, messageID);
    }

    Users.set(targetID, { banned: false, banReason: null, banDate: null });

    return api.sendMessage(`✅ Đã gỡ ban cho UID ${targetID}. Người dùng có thể dùng lại bot bình thường.`, threadID, messageID);
  }
};
