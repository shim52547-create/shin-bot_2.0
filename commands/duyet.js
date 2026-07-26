const boxApproval = require("../utils/boxApproval");

module.exports = {
  config: {
    name: "duyet",
    aliases: ["duyetbox"],
    version: "2.0",
    role: 2,
    description: "Duyệt / xem / gỡ các nhóm (box) được phép dùng bot",
    usage:
      "duyet list — xem box đã duyệt\n" +
      "duyet pending — xem box chờ duyệt\n" +
      "duyet approve <stt stt ...|all> — duyệt box theo số thứ tự ở danh sách pending\n" +
      "duyet del <stt hoặc threadID> — gỡ + rời khỏi box đã duyệt\n" +
      "duyet <threadID> — duyệt trực tiếp 1 box theo ID",
    category: "Admin"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const sub = (args[0] || "").toLowerCase();

    // ==== duyet list / l ====
    if (sub === "list" || sub === "l") {
      const approved = boxApproval.getApproved();
      if (!approved.length) return api.sendMessage("📭 Chưa có box nào được duyệt.", threadID, messageID);

      let msg = "[ Nhóm Đã Duyệt ]\n";
      for (const [index, id] of approved.entries()) {
        const info = await api.getThreadInfo(id).catch(() => null);
        msg += `\n${index + 1}. ${info?.threadName || "Tên không xác định"}\n🧬 ID: ${id}`;
      }
      msg += `\n\n📌 Dùng "duyet del <stt>" để gỡ 1 box.`;
      return api.sendMessage(msg, threadID, messageID);
    }

    // ==== duyet pending / p ====
    if (sub === "pending" || sub === "p") {
      const pending = boxApproval.getPending();
      if (!pending.length) return api.sendMessage("📭 Không có box nào đang chờ duyệt.", threadID, messageID);

      let msg = "[ Box Chưa Duyệt ]\n";
      for (const [index, id] of pending.entries()) {
        const info = await api.getThreadInfo(id).catch(() => null);
        msg += `\n${index + 1}. ${info?.threadName || "Tên không xác định"}\n🧬 ID: ${id}`;
      }
      msg += `\n\n📌 Dùng "duyet approve <stt stt ...>" hoặc "duyet approve all" để duyệt.`;
      return api.sendMessage(msg, threadID, messageID);
    }

    // ==== duyet approve <stt...|all> ====
    if (sub === "approve" || sub === "a") {
      let approved = boxApproval.getApproved();
      let pending = boxApproval.getPending();

      if (!pending.length) return api.sendMessage("📭 Không có box nào đang chờ duyệt.", threadID, messageID);

      if ((args[1] || "").toLowerCase() === "all") {
        approved = approved.concat(pending);
        for (const id of pending) {
          api.sendMessage("✅ Nhóm của bạn đã được phê duyệt!\n📝 Chúc các bạn dùng bot vui vẻ", id);
        }
        boxApproval.setApproved(approved);
        boxApproval.setPending([]);
        return api.sendMessage(`✅ Đã phê duyệt toàn bộ ${pending.length} box.`, threadID, messageID);
      }

      const numbers = args.slice(1).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
      if (!numbers.length) {
        return api.sendMessage("⚠️ Vui lòng nhập số thứ tự (xem qua \"duyet pending\") hoặc \"all\".", threadID, messageID);
      }

      // Duyệt theo index giảm dần để splice không bị lệch vị trí
      const uniqueIndexes = [...new Set(numbers.map(n => n - 1))].sort((a, b) => b - a);
      let successCount = 0;
      for (const index of uniqueIndexes) {
        if (index >= 0 && index < pending.length) {
          const idBox = pending[index];
          approved.push(idBox);
          pending.splice(index, 1);
          api.sendMessage("✅ Nhóm của bạn đã được phê duyệt!\n📝 Chúc các bạn dùng bot vui vẻ", idBox);
          successCount++;
        }
      }
      boxApproval.setApproved(approved);
      boxApproval.setPending(pending);

      return successCount > 0
        ? api.sendMessage(`✅ Phê duyệt thành công ${successCount} box.`, threadID, messageID)
        : api.sendMessage("❎ Không có box nào được duyệt, vui lòng kiểm tra lại số thứ tự.", threadID, messageID);
    }

    // ==== duyet del / d <stt hoặc threadID> ====
    if (sub === "del" || sub === "d") {
      let approved = boxApproval.getApproved();
      const target = args[1];
      if (!target) return api.sendMessage("⚠️ Vui lòng nhập số thứ tự hoặc threadID cần gỡ.", threadID, messageID);

      let idBox;
      if (/^\d+$/.test(target) && parseInt(target, 10) <= approved.length && !approved.includes(target)) {
        // là số thứ tự trong danh sách "duyet list"
        idBox = approved[parseInt(target, 10) - 1];
      } else {
        idBox = target;
      }

      if (!idBox || !approved.includes(idBox)) {
        return api.sendMessage("❎ Box này không có trong danh sách đã duyệt.", threadID, messageID);
      }

      approved = approved.filter(id => id !== idBox);
      boxApproval.setApproved(approved);
      await api.removeUserFromGroup(api.getCurrentUserID(), idBox).catch(() => null);
      return api.sendMessage(`✅ Đã gỡ box ${idBox} khỏi danh sách và rời nhóm.`, threadID, messageID);
    }

    // ==== duyet help / h ====
    if (sub === "help" || sub === "h" || !sub) {
      return api.sendMessage(
        `[ Duyệt Box ]\n\n` +
        `duyet list / l — xem box đã duyệt\n` +
        `duyet pending / p — xem box chờ duyệt\n` +
        `duyet approve <stt...|all> — duyệt box theo pending\n` +
        `duyet del <stt|threadID> — gỡ + rời box\n` +
        `duyet <threadID> — duyệt trực tiếp 1 box theo ID`,
        threadID, messageID
      );
    }

    // ==== duyet <threadID> — duyệt trực tiếp ====
    const idBox = args[0];
    if (!/^\d+$/.test(idBox)) {
      return api.sendMessage("❎ ID không hợp lệ.", threadID, messageID);
    }

    const approved = boxApproval.getApproved();
    if (approved.includes(idBox)) {
      return api.sendMessage(`❎ Box ${idBox} đã được phê duyệt trước đó.`, threadID, messageID);
    }

    approved.push(idBox);
    boxApproval.setApproved(approved);
    boxApproval.setPending(boxApproval.getPending().filter(id => id !== idBox));
    api.sendMessage("✅ Nhóm của bạn đã được phê duyệt!\n📝 Chúc các bạn dùng bot vui vẻ", idBox);
    return api.sendMessage(`✅ Phê duyệt thành công box ${idBox}.`, threadID, messageID);
  }
};
