const fs = require("fs-extra");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "config.json");

module.exports = {
  config: {
    name: "admin",
    aliases: [],
    version: "1.0",
    role: 2,
    description: "Thêm/xoá/xem danh sách admin bot",
    usage: "admin <add|remove|list> [uid]",
    category: "Quản trị bot"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, mentions, messageReply } = event;
    const sub = (args[0] || "list").toLowerCase();

    if (sub === "list") {
      return api.sendMessage(`👑 Danh sách admin bot:\n${global.config.ADMIN_BOT.join("\n")}`, threadID, messageID);
    }

    const targetID = messageReply?.senderID || Object.keys(mentions || {})[0] || args[1];
    if (!targetID || !/^\d+$/.test(targetID)) {
      return api.sendMessage("⚠️ Vui lòng cung cấp UID hợp lệ (hoặc tag/reply).", threadID, messageID);
    }

    if (sub === "add") {
      if (global.config.ADMIN_BOT.includes(targetID)) {
        return api.sendMessage("⚠️ UID này đã là admin bot.", threadID, messageID);
      }
      global.config.ADMIN_BOT.push(targetID);
    } else if (sub === "remove") {
      global.config.ADMIN_BOT = global.config.ADMIN_BOT.filter(id => id !== targetID);
    } else {
      return api.sendMessage("⚠️ Cách dùng: admin <add|remove|list> [uid]", threadID, messageID);
    }

    fs.writeJsonSync(CONFIG_PATH, global.config, { spaces: 2 });
    return api.sendMessage(`✅ Đã ${sub === "add" ? "thêm" : "xoá"} admin bot: ${targetID}`, threadID, messageID);
  }
};
