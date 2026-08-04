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

    // Nếu nhóm không có nội dung tuỳ chỉnh -> dùng thông báo mặc định, không cần gọi thêm API
    if (!threadData.customLeave) {
      return api.sendMessage(`👋 Một thành viên (ID: ${leftID}) đã rời khỏi nhóm.`, threadID);
    }

    // Có nội dung tuỳ chỉnh -> lấy tên thành viên + thông tin nhóm để thay placeholder
    let name = leftID;
    let threadName = "";
    let count = "?";

    try {
      const userInfo = await api.getUserInfo(leftID);
      name = userInfo?.[leftID]?.name || leftID;
    } catch (e) { /* bỏ qua, dùng ID nếu không lấy được tên */ }

    try {
      const info = await api.getThreadInfo(threadID);
      threadName = info?.threadName || "";
      count = info?.participantIDs?.length ?? "?";
    } catch (e) { /* bỏ qua, để trống nếu không lấy được */ }

    const body = threadData.customLeave
      .replace(/\{name\}/g, name)
      .replace(/\{threadName\}/g, threadName || "nhóm")
      .replace(/\{count\}/g, count);

    api.sendMessage(body, threadID);
  }
};