const { ThreadBan } = require("../utils/threadBan");
const boxApproval = require("../utils/boxApproval");

module.exports = {
  config: {
    name: "thread",
    version: "2.0.0",
    role: 2,
    description: "Cấm hoặc gỡ cấm nhóm sử dụng bot (bot vẫn ở lại nhóm, chỉ chặn lệnh)",
    usage: "thread ban <threadID> [lý do] | thread unban <threadID> | thread info <threadID> | thread list | thread search <tên>",
    category: "Hệ thống"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const sub = (args[0] || "").toLowerCase();
    const targetID = args[1];

    if (!sub || sub === "help") {
      return api.sendMessage(
        `[ Quản lý nhóm ]\n` +
        `thread ban <threadID> [lý do] — cấm nhóm dùng bot\n` +
        `thread unban <threadID> — gỡ cấm\n` +
        `thread info <threadID> — xem trạng thái 1 nhóm\n` +
        `thread list — danh sách nhóm đang bị cấm\n` +
        `thread search <tên> — tìm nhóm đã duyệt theo tên`,
        threadID, messageID
      );
    }

    if (sub === "ban" || sub === "-b") {
      if (!targetID) return api.sendMessage("⚠️ Thiếu threadID cần cấm.", threadID, messageID);
      if (ThreadBan.isBanned(targetID)) {
        const info = ThreadBan.get(targetID);
        return api.sendMessage(`❎ Nhóm ${targetID} đã bị cấm trước đó${info.reason ? ` (Lý do: ${info.reason})` : ""} lúc ${info.dateAdded}.`, threadID, messageID);
      }
      const reason = args.slice(2).join(" ") || null;
      ThreadBan.ban(targetID, reason);
      return api.sendMessage(`✅ Đã cấm nhóm ${targetID} sử dụng bot.${reason ? `\nLý do: ${reason}` : ""}`, threadID, messageID);
    }

    if (sub === "unban" || sub === "-ub") {
      if (!targetID) return api.sendMessage("⚠️ Thiếu threadID cần gỡ cấm.", threadID, messageID);
      if (!ThreadBan.isBanned(targetID)) return api.sendMessage("❎ Nhóm này chưa từng bị cấm.", threadID, messageID);
      ThreadBan.unban(targetID);
      return api.sendMessage(`✅ Đã gỡ cấm nhóm ${targetID}.`, threadID, messageID);
    }

    if (sub === "info" || sub === "-i") {
      if (!targetID) return api.sendMessage("⚠️ Thiếu threadID cần xem.", threadID, messageID);
      const info = ThreadBan.get(targetID);
      return api.sendMessage(
        info
          ? `[ Info nhóm ${targetID} ]\n- Đang bị cấm: CÓ\n- Lý do: ${info.reason || "(không có)"}\n- Từ lúc: ${info.dateAdded}`
          : `[ Info nhóm ${targetID} ]\n- Đang bị cấm: KHÔNG`,
        threadID, messageID
      );
    }

    if (sub === "list" || sub === "-l") {
      const all = ThreadBan.getAll();
      const ids = Object.keys(all);
      if (ids.length === 0) return api.sendMessage("📭 Hiện không có nhóm nào bị cấm.", threadID, messageID);
      const text = ids.map((id, i) => `${i + 1}. ${id}${all[id].reason ? ` - ${all[id].reason}` : ""}`).join("\n");
      return api.sendMessage(`[ Danh sách nhóm bị cấm ] (${ids.length})\n${text}`, threadID, messageID);
    }

    if (sub === "search" || sub === "-s") {
      const keyword = args.slice(1).join(" ").toLowerCase();
      if (!keyword) return api.sendMessage("⚠️ Vui lòng nhập tên cần tìm.", threadID, messageID);
      const approved = boxApproval.getApproved();
      const matches = [];
      for (const id of approved) {
        const info = await api.getThreadInfo(id).catch(() => null);
        if (info?.threadName?.toLowerCase().includes(keyword)) matches.push({ id, name: info.threadName });
      }
      if (matches.length === 0) return api.sendMessage("❎ Không tìm thấy nhóm nào phù hợp.", threadID, messageID);
      return api.sendMessage(
        `Kết quả tìm kiếm:\n${matches.map((m, i) => `${i + 1}. ${m.name} - ${m.id}`).join("\n")}`,
        threadID, messageID
      );
    }

    return api.sendMessage("⚠️ Sai cú pháp. Gõ \"thread help\" để xem hướng dẫn.", threadID, messageID);
  }
};
