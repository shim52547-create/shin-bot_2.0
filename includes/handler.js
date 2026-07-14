const logger = require("../utils/log");
const { Threads, Users } = require("../utils/database");
const { Ranks } = require("../utils/rank");
const { MessageCount } = require("../utils/messageCount");
const { AntiSpam } = require("../utils/antiSpam");
const { ThreadBan } = require("../utils/threadBan");

module.exports = function ({ api }) {
  return async function handleMessage(event) {
    try {
      if (!event || event.type !== "message" && event.type !== "message_reply") return;
      const body = (event.body || "").trim();
      if (!body) return;

      // Chặn user đã bị auto-ban vì spam
      if (AntiSpam.isBanned(event.senderID)) return;

      // Cộng EXP rank cho mọi tin nhắn hợp lệ (kể cả tin nhắn gõ lệnh).
      // Hàm này tự có cooldown riêng cho từng người nên gọi vô tư ở đây.
      Ranks.addExpOnChat(event.senderID);

      // Đếm số tin nhắn trong ngày cho bảng xếp hạng !count (tự reset theo ngày, không cooldown)
      MessageCount.addMessage(event.threadID, event.senderID);

      const threadID = event.threadID;
      const threadData = Threads.get(threadID);
      const prefix = threadData.prefix || global.config.PREFIX;

      if (!body.startsWith(prefix)) {
        // Không phải lệnh có prefix -> vẫn cho các lệnh có onChat (vd: game bài cào) xử lý tin nhắn thường
        for (const command of global.client.commands.values()) {
          if (typeof command.onChat !== "function") continue;
          try {
            await command.onChat({ api, event, Threads, Users });
          } catch (err) {
            logger.error(`Lỗi onChat "${command.config.name}": ${err.message}`, "HANDLER");
          }
        }
        return;
      }

      const args = body.slice(prefix.length).trim().split(/\s+/);
      const commandName = (args.shift() || "").toLowerCase();
      if (!commandName) return;

      const command =
        global.client.commands.get(commandName) ||
        [...global.client.commands.values()].find(c => (c.config.aliases || []).includes(commandName));

      if (!command) return;

      // Kiểm tra quyền: 0 = ai cũng dùng được, 1 = quản trị viên nhóm, 2 = admin bot
      const role = command.config.role || 0;

      // Nhóm bị cấm dùng bot -> chặn mọi lệnh, trừ lệnh admin bot (role 2, vd "thread unban")
      if (role < 2 && ThreadBan.isBanned(threadID)) return;

      if (role >= 2 && !global.config.ADMIN_BOT.includes(event.senderID)) {
        return api.sendMessage("⛔ Lệnh này chỉ dành cho admin bot.", threadID, event.messageID);
      }
      if (role === 1) {
        const threadInfo = await api.getThreadInfo(threadID).catch(() => null);
        const isGroupAdmin =
          threadInfo?.adminIDs?.some(a => a.id === event.senderID) ||
          global.config.ADMIN_BOT.includes(event.senderID);
        if (!isGroupAdmin) {
          return api.sendMessage("⛔ Lệnh này chỉ dành cho quản trị viên nhóm hoặc admin bot.", threadID, event.messageID);
        }
      }

      // Đếm spam lệnh; nếu vừa bị ban thì báo và dừng
      if (AntiSpam.hit(event.senderID)) {
        return api.sendMessage(
          `⚡ Bạn đã bị cấm dùng bot vì spam ${AntiSpam.NUM} lần/${AntiSpam.TIME}s. Liên hệ admin bot để được gỡ.`,
          threadID, event.messageID
        );
      }

      logger.info(`${event.senderID} → ${prefix}${commandName}`, "CMD");
      await command.run({ api, event, args, Threads, Users });
    } catch (err) {
      logger.error(err.stack || err.message || String(err), "HANDLER");
    }
  };
};
