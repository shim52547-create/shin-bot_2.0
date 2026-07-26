module.exports = {
  config: {
    name: "listqtv",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Danh sách quản trị viên nhóm",
    usage: "listqtv",
    category: "Nhóm"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID } = event;
    const { adminIDs } = await api.getThreadInfo(threadID);

    let msg = `[ ${adminIDs.length} quản trị viên nhóm ]\n`;
    for (let i = 0; i < adminIDs.length; i++) {
      const info = await api.getUserInfo(adminIDs[i].id).catch(() => null);
      msg += `\n${i + 1}. ${info?.[adminIDs[i].id]?.name || "Không rõ tên"}`;
    }
    return api.sendMessage(msg, threadID, messageID);
  }
};
