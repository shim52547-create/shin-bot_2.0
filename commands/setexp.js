const { Ranks } = require("../utils/rank");

// Lưu ý: bot này không lưu "exp" trong Currencies (tiền), mà lưu riêng trong
// Ranks (data/rank.json) - dùng cho hệ thống rank/level ở lệnh "rank"/"rankup".
// Bản gốc của lệnh này viết cho 1 bot khác (Currencies.setData({exp: ...})),
// không khớp với cấu trúc data của MiraiBot-Clean nên đã viết lại toàn bộ.

module.exports = {
  config: {
    name: "setexp",
    aliases: [],
    version: "1.0",
    role: 2, // chỉ admin bot mới dùng được
    description: "Đặt hoặc xoá số EXP rank của bản thân / người khác (admin bot)",
    usage:
      "setexp me <số>\n" +
      "setexp @tag <số> (tag được nhiều người)\n" +
      "setexp uid <UID> <số>\n" +
      "setexp del me / @tag / uid <UID>",
    category: "Kinh tế"
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID, mentions } = event;
    const prefix = global.config.PREFIX || "!";

    const syntaxError = () =>
      api.sendMessage(
        `⚠️ Sai cú pháp. Cách dùng:\n` +
        `${prefix}setexp me <số>\n` +
        `${prefix}setexp @tag <số>\n` +
        `${prefix}setexp uid <UID> <số>\n` +
        `${prefix}setexp del me / @tag / uid <UID>`,
        threadID, messageID
      );

    if (args.length === 0) return syntaxError();

    // ---------- setexp del ... ----------
    if (args[0] === "del") {
      if (args[1] === "me") {
        const old = Ranks.getData(senderID).exp;
        Ranks.setData(senderID, { exp: 0 });
        return api.sendMessage(`✅ Đã xoá toàn bộ EXP của bạn (trước đó: ${old}).`, threadID, messageID);
      }

      if (mentions && Object.keys(mentions).length > 0) {
        const lines = [];
        for (const id of Object.keys(mentions)) {
          const old = Ranks.getData(id).exp;
          Ranks.setData(id, { exp: 0 });
          lines.push(`• ${mentions[id].replace("@", "")}: đã xoá ${old} EXP`);
        }
        return api.sendMessage(`✅ Đã xoá EXP:\n${lines.join("\n")}`, threadID, messageID);
      }

      if (args[1] === "uid" && args[2]) {
        const id = args[2];
        const old = Ranks.getData(id).exp;
        Ranks.setData(id, { exp: 0 });
        return api.sendMessage(`✅ Đã xoá toàn bộ EXP của UID ${id} (trước đó: ${old}).`, threadID, messageID);
      }

      return syntaxError();
    }

    // ---------- setexp uid <UID> <số> ----------
    if (args[0] === "uid") {
      const id = args[1];
      const value = parseInt(args[2]);
      if (!id || isNaN(value)) return syntaxError();

      Ranks.setData(id, { exp: value });

      let dispName = id;
      try {
        const info = await api.getUserInfo(id);
        dispName = info?.[id]?.name || id;
      } catch (e) { /* bỏ qua, dùng UID làm tên hiển thị */ }

      return api.sendMessage(`✅ Đã đặt EXP của ${dispName} thành ${value}.`, threadID, messageID);
    }

    // ---------- setexp me <số> ----------
    if (args[0] === "me") {
      const value = parseInt(args[1]);
      if (isNaN(value)) return syntaxError();

      Ranks.setData(senderID, { exp: value });
      return api.sendMessage(`✅ Đã đặt EXP của bạn thành ${value}.`, threadID, messageID);
    }

    // ---------- setexp @tag <số> (có thể tag nhiều người cùng lúc) ----------
    if (mentions && Object.keys(mentions).length > 0) {
      const value = parseInt(args[args.length - 1]);
      if (isNaN(value)) return syntaxError();

      const mentionList = [];
      for (const id of Object.keys(mentions)) {
        Ranks.setData(id, { exp: value });
        mentionList.push({ tag: mentions[id].replace("@", ""), id: parseInt(id) });
      }

      return api.sendMessage(
        {
          body: `✅ Đã đặt EXP của ${mentionList.map(m => m.tag).join(", ")} thành ${value}.`,
          mentions: mentionList
        },
        threadID, messageID
      );
    }

    return syntaxError();
  }
};
