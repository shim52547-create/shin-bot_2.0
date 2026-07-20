const lyricsFinder = require("lyrics-finder");

module.exports = {
  config: {
    name: "lyrics",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Xem lời bài hát",
    usage: "lyrics <tên bài hát>",
    category: "Media"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    if (!args.length) return api.sendMessage("⚠️ Vui lòng nhập tên bài hát.", threadID, messageID);

    try {
      const lyrics = await lyricsFinder(args.join(" "));
      if (!lyrics) return api.sendMessage("❌ Không tìm thấy lời bài hát này.", threadID, messageID);

      // Messenger giới hạn ~20000 ký tự/tin nhắn -> cắt bớt nếu quá dài
      const text = lyrics.length > 19000 ? lyrics.slice(0, 19000) + "\n... (cắt bớt do quá dài)" : lyrics;
      return api.sendMessage(text, threadID, messageID);
    } catch (err) {
      return api.sendMessage("❌ Lỗi khi tìm lời bài hát, thử lại sau.", threadID, messageID);
    }
  }
};
