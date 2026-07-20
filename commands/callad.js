// Giống goiadmin.js nhưng gửi TIN NHẮN RIÊNG cho từng quản trị viên nhóm
// thay vì tag trong box chat.
// Chống spam: 1 nhóm chỉ được gọi tối đa 1 lần / 60 giây
const cooldownMap = new Map();
const COOLDOWN_MS = 60 * 1000;

module.exports = {
  config: {
    name: "callad",
    aliases: ["callriengadmin", "dmadmin"],
    version: "1.0",
    role: 0,
    description: "Nhắn tin RIÊNG cho toàn bộ quản trị viên nhóm kèm lời nhắn của bạn (không tag trong box)",
    usage: "callad <nội dung cần báo>",
    category: "Box chat"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const content = args.join(" ").trim();

    const last = cooldownMap.get(threadID) || 0;
    const remain = COOLDOWN_MS - (Date.now() - last);
    if (remain > 0) {
      return api.sendMessage(`⏳ Vui lòng đợi ${Math.ceil(remain / 1000)}s nữa để gọi admin tiếp.`, threadID, messageID);
    }

    const threadInfo = await api.getThreadInfo(threadID).catch(() => null);
    const botID = api.getCurrentUserID();
    let adminIDs = (threadInfo?.adminIDs || []).map(a => a.id).filter(id => id !== botID);

    // Nếu box không có quản trị viên nào (hiếm), gọi luôn admin bot làm phương án dự phòng
    if (!adminIDs.length) {
      adminIDs = (global.config.ADMIN_BOT || []).filter(id => id !== botID);
    }

    if (!adminIDs.length) {
      return api.sendMessage("⚠️ Không tìm thấy quản trị viên nào trong nhóm để gọi.", threadID, messageID);
    }

    let userInfo = {};
    try {
      userInfo = await api.getUserInfo(adminIDs);
    } catch (e) {
      userInfo = {};
    }

    let callerName = "Một thành viên";
    try {
      const senderData = await api.getUserInfo([senderID]);
      callerName = senderData[senderID]?.name || callerName;
    } catch (e) { /* bỏ qua, dùng tên mặc định */ }

    const groupName = threadInfo?.threadName || `nhóm (ID: ${threadID})`;

    let dmBody = `🚨 CÓ NGƯỜI GỌI ADMIN 🚨\n\n`;
    dmBody += `📍 Tại nhóm: ${groupName}\n`;
    dmBody += `📣 Người gọi: ${callerName}\n`;
    dmBody += content ? `📝 Nội dung: ${content}` : `📝 Nội dung: (không có nội dung kèm theo)`;

    cooldownMap.set(threadID, Date.now());

    // Gửi riêng cho từng admin, không tag trong nhóm.
    // threadID khi gửi 1-1 chính là UID của người nhận (Messenger coi đây là 1 thread riêng).
    const results = await Promise.allSettled(
      adminIDs.map(id => api.sendMessage(dmBody, id))
    );

    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failedNames = results
      .map((r, i) => ({ r, id: adminIDs[i] }))
      .filter(({ r }) => r.status === "rejected")
      .map(({ id }) => userInfo[id]?.name || `UID ${id}`);

    let reply = `✅ Đã nhắn tin riêng cho ${successCount}/${adminIDs.length} quản trị viên.`;
    if (failedNames.length) {
      reply += `\n⚠️ Không gửi được cho: ${failedNames.join(", ")} (có thể do họ chưa từng nhắn với bot nên tin bị đưa vào Message Requests, hoặc đã chặn bot).`;
    }

    return api.sendMessage(reply, threadID, messageID);
  }
};
