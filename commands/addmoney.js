const { Currencies } = require("../utils/currency");

// Cho phép nhập số tắt kiểu Việt Nam: 10k = 10.000, 1tr = 1.000.000, 1ty = 1.000.000.000
// Vẫn nhận số thường: 50000, 1500000...
function parseAmount(raw) {
  if (!raw) return NaN;
  const s = String(raw).toLowerCase().replace(/,/g, "").trim();
  const m = s.match(/^(\d+(\.\d+)?)(k|tr|ty)?$/);
  if (!m) return NaN;
  let num = parseFloat(m[1]);
  if (m[3] === "k") num *= 1e3;
  else if (m[3] === "tr") num *= 1e6;
  else if (m[3] === "ty") num *= 1e9;
  return Math.round(num);
}

async function getName(api, uid) {
  try {
    const info = await api.getUserInfo(uid);
    return info?.[uid]?.name || uid;
  } catch (e) {
    return uid;
  }
}

// Xác định người nhận tiền: ưu tiên reply > tag (mention) > uid gõ tay > chính mình
function resolveTarget(event, args) {
  if (event.type === "message_reply" && event.messageReply?.senderID) {
    return { targetID: event.messageReply.senderID, amountArg: args[0] };
  }
  const mentionIDs = Object.keys(event.mentions || {});
  if (mentionIDs.length > 0) {
    // args thường có cả từ trong tag, nên số tiền lấy ở arg cuối cùng
    return { targetID: mentionIDs[0], amountArg: args[args.length - 1] };
  }
  if (args[0] && /^\d{5,20}$/.test(args[0])) {
    return { targetID: args[0], amountArg: args[1] };
  }
  return { targetID: event.senderID, amountArg: args[0] };
}

module.exports = {
  config: {
    name: "addmoney",
    aliases: ["add", "congxu", "themxu"],
    version: "1.0.0",
    role: 2, // chỉ admin bot mới dùng được
    description: "Cộng xu cho người chơi (admin)",
    category: "Quản trị",
    usages:
      "addmoney <số tiền> — cộng xu cho chính bạn\n" +
      "addmoney <uid> <số tiền> — cộng xu cho người theo UID\n" +
      "addmoney <số tiền> (kèm @tag người trong tin nhắn) — cộng xu cho người bị tag\n" +
      "(reply tin nhắn của ai đó) + addmoney <số tiền> — cộng xu cho người đó\n" +
      "Số tiền có thể viết tắt: 10k = 10.000, 1tr = 1.000.000, 1ty = 1.000.000.000",
    cooldowns: 0
  },

  run: async function ({ api, event, args }) {
    const { threadID, messageID } = event;

    const { targetID, amountArg } = resolveTarget(event, args);
    const amount = parseAmount(amountArg);

    if (!targetID) {
      return api.sendMessage("⚠️ Không xác định được người nhận. Reply tin nhắn, tag người, hoặc nhập UID.", threadID, messageID);
    }
    if (!amount || isNaN(amount) || amount === 0) {
      return api.sendMessage(
        "⚠️ Số tiền không hợp lệ.\nVí dụ: addmoney 50000 | addmoney 10k | addmoney <uid> 1tr",
        threadID, messageID
      );
    }
    if (amount < 0) {
      Currencies.decreaseMoney(targetID, Math.abs(amount));
    } else {
      Currencies.increaseMoney(targetID, amount);
    }

    const targetName = await getName(api, targetID);
    const newBalance = Currencies.getData(targetID).money;

    return api.sendMessage(
      `💰 ĐÃ ${amount < 0 ? "TRỪ" : "CỘNG"} XU\n` +
      `——————————————\n` +
      `👤 Người nhận: ${targetName}\n` +
      `${amount < 0 ? "➖" : "➕"} Số tiền: ${Math.abs(amount).toLocaleString("en-US")} xu\n` +
      `💵 Số dư hiện tại: ${newBalance.toLocaleString("en-US")} xu`,
      threadID, messageID
    );
  }
};
