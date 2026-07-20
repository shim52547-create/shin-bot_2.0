// Chống spam: 1 nhóm chỉ được gọi admin tối đa 1 lần / 60 giây
const cooldownMap = new Map();
const COOLDOWN_MS = 60 * 1000;

module.exports = {
  config: {
    name: "goiadmin",
    aliases: ["calladmin", "adminoi"],
    version: "1.0",
    role: 0,
    description: "Tag toàn bộ quản trị viên nhóm kèm lời nhắn của bạn",
    usage: "goiadmin <nội dung cần báo>",
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

    let body = "🚨 GỌI ADMIN 🚨\n\n";
    const mentions = [];
    for (const id of adminIDs) {
      const name = userInfo[id]?.name || `UID ${id}`;
      const tag = `@${name}`;
      mentions.push({ tag, id });
      body += `${tag} `;
    }
    body += `\n\n📣 Người gọi: ${callerName}`;
    body += content ? `\n📝 Nội dung: ${content}` : `\n📝 Nội dung: (không có nội dung kèm theo)`;

    cooldownMap.set(threadID, Date.now());
    return api.sendMessage({ body, mentions }, threadID, messageID);
  }
};
