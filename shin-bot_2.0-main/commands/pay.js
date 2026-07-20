const { Currencies } = require("../utils/currency");

const TAX_RATE = 0.15;
const cooldownMap = new Map();
const COOLDOWN_MS = 5000;

module.exports = {
  config: {
    name: "pay",
    aliases: ["chuyentien"],
    version: "1.0",
    role: 0,
    description: "Chuyển xu cho người khác (giao dịch bị trừ 15% thuế)",
    usage: "pay <tag/reply người nhận> <số tiền>",
    category: "Kinh tế"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID, mentions, messageReply } = event;

    // Chống spam lệnh
    const last = cooldownMap.get(senderID) || 0;
    const now = Date.now();
    if (now - last < COOLDOWN_MS) {
      return api.sendMessage(
        `⏳ Vui lòng chờ ${(((COOLDOWN_MS - (now - last)) / 1000).toFixed(1))}s trước khi dùng lại lệnh pay.`,
        threadID, messageID
      );
    }

    // Xác định người nhận: ưu tiên reply, sau đó tag
    let targetID = messageReply?.senderID;
    if (!targetID) {
      const mentionIDs = Object.keys(mentions || {});
      if (mentionIDs.length === 0) {
        return api.sendMessage(
          "⚠️ Bạn phải tag hoặc reply người cần chuyển tiền.\nCách dùng: pay <tag người nhận> <số tiền>",
          threadID, messageID
        );
      }
      if (mentionIDs.length > 1) {
        return api.sendMessage("⚠️ Vui lòng chỉ tag một người duy nhất.", threadID, messageID);
      }
      targetID = mentionIDs[0];
    }

    if (targetID === senderID) {
      return api.sendMessage("⚠️ Bạn không thể chuyển tiền cho chính mình.", threadID, messageID);
    }

    // Số tiền luôn là phần tử cuối cùng trong args (vd: "pay @A 500" -> args = ["@A", "500"])
    const amountRaw = args[args.length - 1];
    const amount = parseInt(amountRaw, 10);

    if (!amountRaw || isNaN(amount) || amount < 1) {
      return api.sendMessage(
        "⚠️ Số tiền không hợp lệ.\nCách dùng: pay <tag người nhận> <số tiền>",
        threadID, messageID
      );
    }

    const payerData = Currencies.getData(senderID);
    if (!payerData || payerData.money < amount) {
      return api.sendMessage(
        `⚠️ Bạn không đủ xu để thực hiện giao dịch! (Số dư hiện tại: ${payerData?.money ?? 0} xu)`,
        threadID, messageID
      );
    }

    const tax = Math.floor(amount * TAX_RATE);
    const received = amount - tax;

    try {
      Currencies.decreaseMoney(senderID, amount);
      Currencies.increaseMoney(targetID, received);
      cooldownMap.set(senderID, now);

      let targetName = "Người dùng";
      try {
        const info = await api.getUserInfo(targetID);
        targetName = info?.[targetID]?.name || targetName;
      } catch (e) { /* bỏ qua lỗi lấy tên, vẫn gửi thành công */ }

      return api.sendMessage(
        `✅ Đã chuyển thành công ${received} xu (đã trừ ${tax} xu thuế 15%) cho ${targetName} (${targetID}).`,
        threadID, messageID
      );
    } catch (err) {
      return api.sendMessage("❌ Đã xảy ra lỗi không mong muốn trong lúc thực hiện giao dịch.", threadID, messageID);
    }
  }
};
