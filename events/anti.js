const fs = require("fs-extra");
const { Threads } = require("../utils/database");

module.exports = {
  config: {
    name: "anti",
    eventType: [
      "log:thread-name",
      "log:thread-image",
      "log:thread-icon",
      "log:thread-color",
      "log:user-nickname",
      "log:unsubscribe"
    ]
  },
  run: async ({ api, event }) => {
    const { threadID, logMessageType, logMessageData, author } = event;
    if (!author || author === api.getCurrentUserID()) return; // bỏ qua hành động của chính bot

    const threadData = Threads.get(threadID);
    const anti = threadData.anti || {};

    try {
      switch (logMessageType) {
        case "log:thread-name": {
          if (!anti.namebox?.enabled) return;
          const original = anti.namebox.name;
          if (original && logMessageData?.name !== original) {
            await api.setTitle(original, threadID);
            api.sendMessage("☑️ Đã khôi phục tên nhóm (anti namebox đang bật).", threadID);
          }
          break;
        }
        case "log:thread-image": {
          if (!anti.image?.enabled) return;
          const cachePath = anti.image.cachePath;
          if (cachePath && (await fs.pathExists(cachePath))) {
            await api.changeGroupImage(fs.createReadStream(cachePath), threadID);
            api.sendMessage("☑️ Đã khôi phục ảnh nhóm (anti image đang bật).", threadID);
          }
          break;
        }
        case "log:thread-icon": {
          if (!anti.emoji?.enabled) return;
          const original = anti.emoji.emoji;
          if (original) {
            await api.changeThreadEmoji(original, threadID);
            api.sendMessage("☑️ Đã khôi phục emoji nhóm (anti emoji đang bật).", threadID);
          }
          break;
        }
        case "log:thread-color": {
          if (!anti.theme?.enabled) return;
          const original = anti.theme.themeID;
          if (original) {
            await api.changeThreadColor(original, threadID);
            api.sendMessage("☑️ Đã khôi phục chủ đề nhóm (anti theme đang bật).", threadID);
          }
          break;
        }
        case "log:user-nickname": {
          if (!anti.nickname?.enabled) return;
          const targetID = logMessageData?.participant_id;
          if (!targetID) return;
          const originalNick = anti.nickname.data?.[targetID] || "";
          if (logMessageData?.nickname !== originalNick) {
            await api.changeNickname(originalNick, threadID, targetID);
            api.sendMessage("☑️ Đã khôi phục biệt danh (anti nickname đang bật).", threadID);
          }
          break;
        }
        case "log:unsubscribe": {
          if (!anti.out?.enabled) return;
          const leftID = logMessageData?.leftParticipantFbId;
          if (!leftID || leftID === api.getCurrentUserID()) return;
          await api.addUserToGroup(leftID, threadID);
          api.sendMessage(`☑️ Đã tự động thêm lại thành viên (ID: ${leftID}) vào nhóm (anti out đang bật).`, threadID);
          break;
        }
      }
    } catch (err) {
      // Bot có thể chưa đủ quyền QTV hoặc gặp lỗi tạm thời từ Facebook -> bỏ qua, không crash bot
      console.error("Lỗi anti-revert:", err.message || err);
    }
  }
};
