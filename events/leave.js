const { Threads } = require("../utils/database");

module.exports = {
  config: {
    name: "leave",
    eventType: ["log:unsubscribe"]
  },
  run: async ({ api, event }) => {
    if (!global.config.leaveEvent) return;
    const { threadID, logMessageData } = event;

    // Cho phép từng nhóm tự tắt thông báo này bằng lệnh "setleave off"
    const threadData = Threads.get(threadID);
    if (threadData.leaveNotify === false) return;

    const leftID = logMessageData?.leftParticipantFbId;
    if (!leftID || leftID === api.getCurrentUserID()) return;
    api.sendMessage(`👋 Một thành viên (ID: ${leftID}) đã rời khỏi nhóm.`, threadID);
  }
};