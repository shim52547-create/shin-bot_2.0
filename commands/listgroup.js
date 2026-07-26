module.exports = {
  config: {
    name: "listgroup",
    aliases: ["listbox", "listt"],
    version: "1.0",
    role: 2,
    description: "Liệt kê các nhóm bot đang tham gia (sắp xếp theo số thành viên)",
    usage: "listgroup | listgroup out <stt>",
    category: "Admin"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    // listgroup out <stt> -> phải liệt kê lại để lấy đúng thứ tự (tránh cache sai lệch)
    const groups = await getSortedGroups(api);

    if ((args[0] || "").toLowerCase() === "out") {
      const idx = parseInt(args[1], 10) - 1;
      const target = groups[idx];
      if (!target) return api.sendMessage("⚠️ Số thứ tự không hợp lệ, hãy dùng \"listgroup\" trước.", threadID, messageID);
      await api.removeUserFromGroup(api.getCurrentUserID(), target.id).catch(() => null);
      return api.sendMessage(`✅ Đã out khỏi nhóm: ${target.name}\n🧬 ID: ${target.id}`, threadID, messageID);
    }

    if (!groups.length) return api.sendMessage("📭 Bot chưa tham gia nhóm nào.", threadID, messageID);

    let msg = `[ Danh sách ${groups.length} nhóm ]\n`;
    groups.forEach((g, i) => msg += `\n${i + 1}. ${g.name}\n🧬 ID: ${g.id} | 👥 ${g.sotv} thành viên`);
    msg += `\n\n📌 Dùng "listgroup out <stt>" để rời nhóm tương ứng.`;
    return api.sendMessage(msg, threadID, messageID);
  }
};

async function getSortedGroups(api) {
  const inbox = await api.getThreadList(100, null, ["INBOX"]);
  const groups = inbox.filter(t => t.isSubscribed && t.isGroup);
  const list = [];
  for (const g of groups) {
    const info = await api.getThreadInfo(g.threadID).catch(() => null);
    list.push({ id: g.threadID, name: g.name || "Không tên", sotv: info?.userInfo?.length || 0 });
  }
  return list.sort((a, b) => b.sotv - a.sotv);
}
