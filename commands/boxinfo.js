module.exports = {
  config: {
    name: "boxinfo",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Xem thông tin nhóm hiện tại",
    usage: "boxinfo",
    category: "Box chat"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID } = event;
    const threadInfo = await api.getThreadInfo(threadID);

    let nam = 0, nu = 0;
    for (const uid in threadInfo.userInfo || {}) {
      const g = threadInfo.userInfo[uid].gender;
      if (g === "MALE") nam++;
      else if (g === "FEMALE") nu++;
    }

    const pd = threadInfo.approvalMode === true ? "bật" : threadInfo.approvalMode === false ? "tắt" : "Không rõ";
    const body =
      `⭐️ Tên: ${threadInfo.threadName}\n` +
      `👨‍💻 ID Box: ${threadInfo.threadID}\n` +
      `👀 Phê duyệt: ${pd}\n` +
      `🧠 Emoji: ${threadInfo.emoji}\n` +
      `👉 Thông tin: gồm ${threadInfo.participantIDs.length} thành viên\n` +
      `Số tv nam 🧑‍🦰: ${nam} thành viên\n` +
      `Số tv nữ 👩‍🦰: ${nu} thành viên\n` +
      `Với ${threadInfo.adminIDs.length} quản trị viên\n` +
      `🕵️‍♀️ Tổng số tin nhắn: ${threadInfo.messageCount} tin.`;

    let attachment = null;
    try {
      if (threadInfo.imageSrc) {
        attachment = await global.utils.getStreamFromURL(threadInfo.imageSrc);
      }
    } catch (e) {
      attachment = null;
    }

    return api.sendMessage(attachment ? { body, attachment } : body, threadID, messageID);
  }
};
