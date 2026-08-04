const fs = require("fs-extra");
const path = require("path");
const boxApproval = require("../utils/boxApproval");
const { Threads } = require("../utils/database");
const logger = require("../utils/log");

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

      // Tự đổi biệt danh của bot trong nhóm mới này
      const botNickname = "´꒳`𝓑𝓸𝓽𝓒𝓱𝓲̀𝓶𝓵𝓸𝓲모";
      api.changeNickname(botNickname, threadID, botID, (err) => {
        if (err) {
          logger.warn(`Không đổi được biệt danh bot ở nhóm ${threadID}: ${err.message || JSON.stringify(err)}`, "WELCOME");
        }
      });
    }

    if (!global.config.welcomeEvent) return;
    if (author !== botID && logMessageData?.addedParticipants) {
      const threadData = Threads.get(threadID);
      let threadName = "";
      let totalMember = 0;
      if (threadData.customJoin) {
        try {
          const info = await api.getThreadInfo(threadID);
          threadName = info?.threadName || "";
          totalMember = info?.participantIDs?.length || 0;
        } catch (e) { /* bỏ qua, để trống tên nhóm/số tv nếu không lấy được */ }
      }

      const gifPath = path.join(GIF_DIR, `${threadID}.gif`);
      const hasGif = fs.existsSync(gifPath);

      // Nếu 1 lần có nhiều người vào cùng lúc, đánh số thứ tự tăng dần
      // (người đầu tiên trong danh sách sẽ là thành viên "cũ" nhất trong đợt này).
      const newMembers = logMessageData.addedParticipants.filter(u => u.userFbId !== botID);

      newMembers.forEach((user, idx) => {
        // Thứ hạng thành viên = tổng số tv hiện tại - số người vào cùng đợt + vị trí trong đợt
        const rank = totalMember ? totalMember - newMembers.length + idx + 1 : 0;

        const body = threadData.customJoin
          ? threadData.customJoin
              .replace(/\{name\}/g, user.fullName || "bạn")
              .replace(/\{threadName\}/g, threadName || "nhóm")
              .replace(/\{count\}/g, rank || "?")
          : `👋 Chào mừng ${user.fullName || "bạn"} đã tham gia nhóm!`;

        if (hasGif) {
          api.sendMessage({ body, attachment: fs.createReadStream(gifPath) }, threadID);
        } else {
          api.sendMessage(body, threadID);
        }
      });
    }
  }
};