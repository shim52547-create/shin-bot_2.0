module.exports = {
  config: {
    name: "kickndfb",
    aliases: [],
    version: "1.0",
    role: 1,
    description: "Kick các tài khoản không rõ giới tính (nghi ngờ acc ảo/clone)",
    usage: "kickndfb",
    category: "Nhóm"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID } = event;
    const { userInfo, adminIDs } = await api.getThreadInfo(threadID);
    const targets = userInfo.filter(u => u.gender == undefined).map(u => u.id);

    if (!targets.length) return api.sendMessage("✅ Không có tài khoản nghi vấn trong nhóm.", threadID, messageID);
    if (!adminIDs.some(a => a.id === api.getCurrentUserID())) {
      return api.sendMessage(`⚠️ Có ${targets.length} tài khoản nghi vấn, nhưng bot cần là quản trị viên nhóm để kick.`, threadID, messageID);
    }

    api.sendMessage(`🔎 Phát hiện ${targets.length} tài khoản, bắt đầu lọc...`, threadID, messageID);
    let success = 0, fail = 0;
    for (const id of targets) {
      try {
        await new Promise(r => setTimeout(r, 1000));
        await api.removeUserFromGroup(id, threadID);
        success++;
      } catch { fail++; }
    }
    return api.sendMessage(`✅ Đã kick ${success} người.${fail ? ` ❌ Thất bại ${fail} người.` : ""}`, threadID);
  }
};
