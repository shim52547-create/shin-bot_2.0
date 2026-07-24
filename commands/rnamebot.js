module.exports = {
  config: {
    name: "rnamebot",
    aliases: ["doitenbot"],
    version: "1.2",
    role: 2,
    description: "Đổi biệt danh của bot trong nhóm hiện tại",
    usage: "rnamebot [biệt danh mới] (để trống sẽ dùng tên mặc định)",
    category: "Hệ thống"
  },
  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;
    const custom = args.join(" ");
    const botID = api.getCurrentUserID();

    // Lấy dữ liệu nhóm hiện tại để lấy prefix (nếu có)
    const threadData = Threads.get(threadID);
    
    // Xác định tên sẽ đặt: Nếu người dùng nhập thì lấy nhập, không thì để mặc định
    const nickname = custom.length !== 0
      ? custom
      : `[ ${threadData.prefix || global.config.PREFIX} ] • ${global.config.BOT_NAME || "MiraiBot"}`;

    // Thực hiện đổi tên CHỈ trong nhóm hiện tại
    api.changeNickname(nickname, threadID, botID, (err) => {
      if (err) {
        return api.sendMessage("❌ Đổi tên thất bại. Bot có thể không có quyền đổi biệt danh trong nhóm này.", threadID, messageID);
      }
      
      return api.sendMessage(`✅ Đã đổi biệt danh của bot trong nhóm này thành: ${nickname}`, threadID, messageID);
    });
  }
};
