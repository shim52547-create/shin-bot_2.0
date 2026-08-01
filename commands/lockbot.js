module.exports = {
  config: {
    name: "lockbot",
    aliases: ["khoabot", "onlyadmin"],
    version: "1.0",
    role: 1, // quản trị viên nhóm hoặc admin bot mới bật/tắt được
    description: "Bật/tắt chế độ: khi bật, chỉ QTV nhóm và admin bot mới dùng được lệnh bot, thành viên thường bị chặn",
    usage: "lockbot on/off",
    category: "Box chat"
  },
  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;
    const threadData = Threads.get(threadID);
    const current = !!threadData.lockBot;

    const action = (args[0] || "").toLowerCase();
    const turnOn = action === "on" ? true : action === "off" ? false : !current;

    if (turnOn === current) {
      return api.sendMessage(
        `ℹ️ Chế độ lockbot đã đang ${current ? "bật" : "tắt"} rồi.`,
        threadID, messageID
      );
    }

    Threads.set(threadID, { lockBot: turnOn });

    return api.sendMessage(
      turnOn
        ? "🔒 Đã bật lockbot: từ giờ chỉ QTV nhóm và admin bot mới dùng được các lệnh bot. Thành viên thường sẽ bị chặn."
        : "🔓 Đã tắt lockbot: mọi thành viên đều dùng bot bình thường trở lại.",
      threadID, messageID
    );
  }
};
