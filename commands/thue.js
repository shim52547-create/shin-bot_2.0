const { Rent } = require("../utils/rent");

const WARN_DAYS = 3; // còn <= 3 ngày thì nhắc đóng tiền

module.exports = {
  config: {
    name: "thue",
    aliases: ["rent", "thuebox"],
    version: "1.0",
    role: 0, // tự kiểm tra quyền bên trong (admin bot + operators), không dùng role mặc định
    description: "Quản lý thuê nhóm: đặt hạn thuê, gia hạn, xem trạng thái, quản lý người điều hành",
    usage:
      "thue <số ngày> | thue them <số ngày> | thue tat | thue xem | thue list | " +
      "thue op them <uid> | thue op xoa <uid> | thue op list",
    category: "Quản lý thuê nhóm"
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const sub = (args[0] || "").toLowerCase();

    const isAdminBot = (global.config.ADMIN_BOT || []).includes(senderID);
    const canControl = Rent.canControl(senderID);

    const HELP =
      "📋 HƯỚNG DẪN LỆNH THUÊ NHÓM\n" +
      "———————————————\n" +
      "thue <số ngày> — Đặt lịch thuê mới cho nhóm này\n" +
      "thue them <số ngày> — Gia hạn thêm ngày\n" +
      "thue tat — Ngừng theo dõi thuê nhóm này\n" +
      "thue xem — Xem trạng thái thuê nhóm này\n" +
      "thue list — (Admin bot) Danh sách tất cả nhóm đang thuê\n" +
      "thue op them <uid> — (Admin bot) Thêm người điều hành\n" +
      "thue op xoa <uid> — (Admin bot) Xoá người điều hành\n" +
      "thue op list — Xem danh sách người điều hành";

    // ==== thue op <them|xoa|list> ====
    if (sub === "op") {
      const action = (args[1] || "").toLowerCase();

      if (action === "list") {
        const ops = Rent.getOperators();
        return api.sendMessage(
          ops.length ? `👥 Người điều hành:\n${ops.map(id => `• ${id}`).join("\n")}` : "📭 Chưa có người điều hành nào.",
          threadID, messageID
        );
      }

      if (!isAdminBot) {
        return api.sendMessage("⛔ Chỉ admin bot mới được thêm/xoá người điều hành.", threadID, messageID);
      }

      const uid = (args[2] || "").trim();
      if (!uid) return api.sendMessage("❌ Bạn chưa nhập UID.", threadID, messageID);

      if (action === "them") {
        Rent.addOperator(uid);
        return api.sendMessage(`✅ Đã thêm ${uid} vào danh sách người điều hành.`, threadID, messageID);
      }
      if (action === "xoa") {
        Rent.removeOperator(uid);
        return api.sendMessage(`✅ Đã xoá ${uid} khỏi danh sách người điều hành.`, threadID, messageID);
      }
      return api.sendMessage("❌ Dùng: thue op them <uid> | thue op xoa <uid> | thue op list", threadID, messageID);
    }

    // ==== thue list (chỉ admin bot) ====
    if (sub === "list") {
      if (!isAdminBot) return api.sendMessage("⛔ Lệnh này chỉ dành cho admin bot.", threadID, messageID);
      const all = Rent.getAllThreads();
      const active = Object.entries(all).filter(([, v]) => v.active);
      if (!active.length) return api.sendMessage("📭 Hiện không có nhóm nào đang thuê.", threadID, messageID);
      const lines = active.map(([tid, v]) => `• ${v.baseName} (${tid}) — còn ${v.daysLeft} ngày`).join("\n");
      return api.sendMessage(`📋 DANH SÁCH NHÓM ĐANG THUÊ\n———————————————\n${lines}`, threadID, messageID);
    }

    // ==== thue xem — ai cũng xem được ====
    if (sub === "xem" || sub === "") {
      const info = Rent.getThread(threadID);
      if (!info || !info.active) {
        return api.sendMessage(
          "📭 Nhóm này hiện chưa được thiết lập thuê." + (sub === "" ? `\n\n${HELP}` : ""),
          threadID, messageID
        );
      }
      return api.sendMessage(
        `📋 TRẠNG THÁI THUÊ NHÓM\n———————————————\nTên gốc (biệt danh bot): ${info.baseName}\nCòn lại: ${info.daysLeft} ngày (tổng ${info.totalDays} ngày)`,
        threadID, messageID
      );
    }

    // ==== Các lệnh còn lại (đặt/gia hạn/tắt) — chỉ admin bot + người điều hành ====
    if (!canControl) {
      return api.sendMessage("⛔ Lệnh này chỉ dành cho admin bot và người điều hành.", threadID, messageID);
    }

    // ==== thue tat ====
    if (sub === "tat") {
      const info = Rent.getThread(threadID);
      if (!info || !info.active) return api.sendMessage("ℹ️ Nhóm này hiện không được theo dõi thuê.", threadID, messageID);
      Rent.setThread(threadID, { active: false });
      return api.sendMessage("✅ Đã ngừng theo dõi thuê cho nhóm này. Bot sẽ không tự out nữa.", threadID, messageID);
    }

    // ==== thue them <ngày> ====
    if (sub === "them") {
      const days = parseInt(args[1], 10);
      if (!days || days <= 0) return api.sendMessage("❌ Dùng: thue them <số ngày>", threadID, messageID);

      let info = Rent.getThread(threadID);
      if (!info) {
        const baseName = await Rent.getBotBaseNickname(api, threadID);
        info = Rent.setThread(threadID, {
          baseName, daysLeft: 0, totalDays: 0, active: true, createdAt: Date.now(), lastWarnDay: null
        });
      }
      const newDaysLeft = (info.daysLeft > 0 ? info.daysLeft : 0) + days;
      Rent.setThread(threadID, {
        daysLeft: newDaysLeft,
        totalDays: (info.totalDays || 0) + days,
        active: true,
        lastWarnDay: null
      });

      const updated = Rent.getThread(threadID);
      try {
        await Rent.setBotNickname(api, threadID, Rent.buildNickname(updated.baseName, updated.daysLeft));
      } catch (e) { /* bot có thể chưa có quyền đổi biệt danh trong nhóm */ }

      return api.sendMessage(`✅ Đã gia hạn thêm ${days} ngày. Nhóm hiện còn ${updated.daysLeft} ngày thuê.`, threadID, messageID);
    }

    // ==== thue <ngày> — đặt lịch thuê mới ====
    const days = parseInt(sub, 10);
    if (!days || days <= 0) {
      return api.sendMessage(`❌ Số ngày không hợp lệ.\n\n${HELP}`, threadID, messageID);
    }

    const baseName = await Rent.getBotBaseNickname(api, threadID);
    Rent.setThread(threadID, {
      baseName,
      daysLeft: days,
      totalDays: days,
      active: true,
      createdAt: Date.now(),
      lastWarnDay: null
    });

    try {
      await Rent.setBotNickname(api, threadID, Rent.buildNickname(baseName, days));
    } catch (e) { /* bot có thể chưa có quyền đổi biệt danh trong nhóm */ }

    return api.sendMessage(
      `✅ Đã đặt lịch thuê cho nhóm "${baseName}" — ${days} ngày.\n` +
      `⏰ Bot sẽ tự trừ 1 ngày mỗi khi qua ngày mới, nhắc đóng tiền khi còn ≤ ${WARN_DAYS} ngày, và tự out nhóm nếu hết hạn mà chưa gia hạn.`,
      threadID, messageID
    );
  }
};
