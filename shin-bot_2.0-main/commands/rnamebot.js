module.exports = {
  config: {
    name: "rnamebot",
    aliases: ["doitenbot"],
    version: "1.1",
    role: 2,
    description: "Đổi biệt danh của bot ở toàn bộ nhóm bot đang tham gia",
    usage: "rnamebot [biệt danh mới] (để trống sẽ dùng tên mặc định)",
    category: "Hệ thống"
  },
  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;
    const custom = args.join(" ");
    const botID = api.getCurrentUserID();

    // Lấy đúng danh sách nhóm bot ĐANG THAM GIA THỰC TẾ qua Facebook,
    // thay vì Threads.getAll() (chỉ chứa nhóm đã từng dùng lệnh prefix/rules/anti...
    // nên bỏ sót phần lớn nhóm nếu dùng Threads.getAll()).
    let allGroups = [];
    try {
      let timestamp = null;
      while (true) {
        const batch = await api.getThreadList(100, timestamp, ["INBOX"]);
        if (!batch || !batch.length) break;

        allGroups.push(...batch.filter(t => t.isGroup));

        if (batch.length < 100) break;
        timestamp = batch[batch.length - 1].timestamp;
      }
    } catch (e) {
      return api.sendMessage("❌ Không lấy được danh sách nhóm từ Facebook: " + e.message, threadID, messageID);
    }

    if (!allGroups.length) {
      return api.sendMessage("⚠️ Bot chưa tham gia nhóm nào để đổi tên.", threadID, messageID);
    }

    const threadError = [];
    let count = 0;

    for (const group of allGroups) {
      const id = group.threadID;
      const threadData = Threads.get(id);
      const nickname = custom.length !== 0
        ? custom
        : `[ ${threadData.prefix || global.config.PREFIX} ] • ${global.config.BOT_NAME || "MiraiBot"}`;

      try {
        await new Promise((resolve) => {
          api.changeNickname(nickname, id, botID, (err) => {
            if (err) threadError.push(id);
            resolve();
          });
        });
        count += 1;
      } catch (e) {
        threadError.push(id);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return api.sendMessage(
      `✅ Đã đổi tên thành công cho ${count - threadError.length}/${count} nhóm.` +
      (threadError.length ? `\n⚠️ Lỗi tại ${threadError.length} nhóm.` : ""),
      threadID, messageID
    );
  }
};