module.exports = {
  config: {
    name: "outall",
    aliases: [],
    version: "1.0",
    role: 2,
    description: "Rời khỏi toàn bộ nhóm (trừ nhóm đang chat)",
    usage: "outall confirm",
    category: "Admin"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    if ((args[0] || "").toLowerCase() !== "confirm") {
      return api.sendMessage("⚠️ Hành động này sẽ out KHỎI TOÀN BỘ nhóm (trừ nhóm hiện tại), không thể hoàn tác.\nGõ \"outall confirm\" để xác nhận.", threadID, messageID);
    }

    const inbox = await api.getThreadList(100, null, ["INBOX"]);
    const groups = inbox.filter(t => t.isGroup && t.threadID !== threadID);
    if (!groups.length) return api.sendMessage("📭 Không có nhóm nào khác để rời.", threadID, messageID);

    api.sendMessage(`🚪 Bắt đầu rời ${groups.length} nhóm...`, threadID, messageID);
    let success = 0, fail = 0;
    for (const g of groups) {
      try {
        await api.removeUserFromGroup(api.getCurrentUserID(), g.threadID);
        success++;
      } catch { fail++; }
      await new Promise(r => setTimeout(r, 1500)); // tránh spam quá nhanh bị Facebook khóa
    }
    return api.sendMessage(`✅ Đã rời ${success} nhóm.${fail ? ` ❌ Thất bại ${fail} nhóm.` : ""}`, threadID);
  }
};
