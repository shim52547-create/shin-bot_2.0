const axios = require("axios"); // Hầu hết bot FCA đều có sẵn thư viện này

module.exports = {
  config: {
    name: "lyrics",
    aliases: ["loi", "loibaihat"],
    version: "2.0",
    role: 0,
    description: "Xem lời bài hát (Nhanh, chính xác)",
    usage: "lyrics <tên ca sĩ> - <tên bài hát>",
    category: "Media"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const input = args.join(" ");

    if (!input) {
      return api.sendMessage("⚠️ Vui lòng nhập tên bài hát.\n💡 Ví dụ: lyrics Sơn Tùng M-TP - Lạc Trôi", threadID, messageID);
    }

    let artist = "";
    let title = "";

    // Tách tên ca sĩ và tên bài hát dựa trên dấu "-"
    if (input.includes("-")) {
      const parts = input.split("-").map(s => s.trim());
      if (parts.length >= 2) {
        // Phần trước dấu "-" là ca sĩ, phần sau là bài hát
        artist = parts[0];
        title = parts.slice(1).join(" ");
      }
    } else {
      // Nếu người dùng không nhập dấu "-", tự động lấy làm tên bài hát
      title = input;
    }

    // Gửi trạng thái đang tìm
    api.sendMessage("🔍 Đang tìm lời bài hát, vui lòng chờ chút...", threadID, messageID);

    try {
      // Gọi API lyrics.ovh (Miễn phí, ổn định)
      const res = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);

      if (!res.data.lyrics) {
        return api.sendMessage("❌ Không tìm thấy lời bài hát này.\n💡 Mẹo: Hãy nhập đúng định dạng `<tên ca sĩ> - <tên bài hát>` để kết quả chính xác nhất.", threadID, messageID);
      }

      let lyrics = res.data.lyrics;

      // Messenger giới hạn khoảng 20.000 ký tự 1 tin nhắn -> Cắt bớt nếu quá dài
      if (lyrics.length > 19000) {
        lyrics = lyrics.slice(0, 19000) + "\n\n... (Đã cắt bớt vì lời bài hát quá dài)";
      }

      return api.sendMessage(lyrics, threadID, messageID);

    } catch (error) {
      // Lỗi 404通常是 do không tìm thấy bài hát trên hệ thống
      return api.sendMessage("❌ Rất tiếc, không tìm thấy lời bài hát này trong kho dữ liệu.\n💡 Bạn thử đổi định dạng: `lyrics <tên bài hát> - <tên ca sĩ>` xem sao.", threadID, messageID);
    }
  }
};
