const fs = require("fs-extra");
const path = require("path");
const boxApproval = require("../utils/boxApproval");
const { Threads } = require("../utils/database");

const GIF_DIR = path.join(__dirname, "cache", "joinGif");

module.exports = {
  config: {
    name: "welcome",
    eventType: ["log:subscribe"]
  },
  run: async ({ api, event }) => {
    const { threadID, logMessageData, author } = event;
    const botID = api.getCurrentUserID();

    // Bot vừa được thêm vào 1 box mới -> đưa vào hàng chờ duyệt (utils/boxApproval)
    if (logMessageData?.addedParticipants?.some(u => u.userFbId === botID)) {
      const isNew = boxApproval.addPending(threadID);
      if (isNew) {
        for (const adminID of global.config.ADMIN_BOT || []) {
          api.sendMessage(`📥 Bot vừa được thêm vào box mới (ID: ${threadID}), đang chờ duyệt.\nDùng "duyet pending" để xem.`, adminID);
        }
      }
    }

    if (!global.config.welcomeEvent) return;
    if (author !== botID && logMessageData?.addedParticipants) {
      const threadData = Threads.get(threadID);
      let threadName = "";
      if (threadData.customJoin) {
        try {
          threadName = (await api.getThreadInfo(threadID))?.threadName || "";
        } catch (e) { /* bỏ qua, để trống tên nhóm nếu không lấy được */ }
      }

      const gifPath = path.join(GIF_DIR, `${threadID}.gif`);
      const hasGif = fs.existsSync(gifPath);

      for (const user of logMessageData.addedParticipants) {
        if (user.userFbId === botID) continue;

        const body = threadData.customJoin
          ? threadData.customJoin
              .replace(/\{name\}/g, user.fullName || "bạn")
              .replace(/\{threadName\}/g, threadName || "nhóm")
          : `👋 Chào mừng ${user.fullName || "bạn"} đã tham gia nhóm!`;

        if (hasGif) {
          api.sendMessage({ body, attachment: fs.createReadStream(gifPath) }, threadID);
        } else {
          api.sendMessage(body, threadID);
        }
      }
    }
  }
};
