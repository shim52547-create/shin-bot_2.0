const { Currencies } = require("../utils/currency");
const {
  Fishing, RODS, MAX_ROD_LEVEL, ROD_TIER_ORDER, getRod,
  TIERS, FISH_TIER_ORDER, FISH_INDEX, castRod
} = require("../utils/fishData");
const CAST_COOLDOWN_MS = 25 * 1000;

function formatMs(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} giây`;
  return `${Math.floor(s / 60)} phút ${s % 60} giây`;
}

async function getName(api, uid) {
  try {
    const info = await api.getUserInfo(uid);
    return info?.[uid]?.name || uid;
  } catch (e) {
    return uid;
  }
}

function rodStatLine(rod) {
  if (!rod || !rod.stat) return "";
  return ` — ${rod.statLabel}: ${rod.stat}`;
}

module.exports = {
  config: {
    name: "cauca",
    aliases: ["fishing", "fish"],
    version: "2.0.0",
    role: 0,
    description: "Game câu cá tiên hiệp: thả cần, sưu tầm cá thần thú, bán lấy xu, MUA cần câu từ Thường đến Tối Cao Thần Thoại (SSS)",
    category: "Giải trí",
    usages:
      "cauca — thả cần câu\n" +
      "cauca kho — xem kho cá đang có\n" +
      "cauca ban — bán toàn bộ cá trong kho lấy xu\n" +
      "cauca muacan — mua cần câu phẩm cấp kế tiếp\n" +
      "cauca can — xem cây cần câu hiện tại\n" +
      "cauca bxh — bảng xếp hạng ngư dân\n" +
      "cauca huongdan — xem luật chơi",
    cooldowns: 3
  },

  run: async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const sub = (args[0] || "").toLowerCase();

    // ---------------- HƯỚNG DẪN ----------------
    if (sub === "huongdan" || sub === "help" || sub === "guide") {
      const rodLines = RODS.slice(1).map(r =>
        `[Cấp ${r.level}] ${r.label}${r.price ? ` — giá: ${r.price.toLocaleString("en-US")} xu` : " (mặc định, miễn phí)"}`
      ).join("\n");

      const tierLines = FISH_TIER_ORDER.map(k => `${TIERS[k].emoji} ${TIERS[k].label}`).join(" → ");

      return api.sendMessage(
        "🎣 LUẬT CHƠI CÂU CÁ TIÊN HIỆP:\n" +
        "- cauca: thả cần câu, chờ kết quả (hồi chiêu 25 giây).\n" +
        `- Độ hiếm vật phẩm câu được: ${tierLines}.\n` +
        "- cauca kho: xem toàn bộ cá/vật phẩm đã câu được.\n" +
        "- cauca ban: bán hết cá trong kho lấy xu (phế phẩm/rác không bán được).\n" +
        "- cauca muacan: MUA cần câu ở phẩm cấp kế tiếp bằng xu — mỗi lần mua sẽ ngẫu nhiên " +
        "trúng 1 trong hàng trăm mẫu cần câu tiên hiệp (kèm chỉ số Độ bền/Thần Lực/Hỗn Độn Lực/Quy Tắc Lực riêng).\n" +
        "- cauca can: xem cây cần câu hiện tại (tên, phẩm cấp, chỉ số, mô tả).\n" +
        "- cauca bxh: bảng xếp hạng ngư dân kiếm nhiều xu nhất từ câu cá.\n\n" +
        "🎋 CÁC PHẨM CẤP CẦN CÂU (mua tuần tự, cần mua phẩm cấp trước mới mở khoá phẩm cấp sau):\n" + rodLines,
        threadID, messageID
      );
    }

    // ---------------- XEM CẦN CÂU HIỆN TẠI ----------------
    if (sub === "can" || sub === "xemcan" || sub === "rod") {
      const profile = Fishing.get(senderID);
      const rodTier = getRod(profile.rodLevel);
      const rod = profile.rod;
      const caption =
        `🎋 CẦN CÂU HIỆN TẠI (Phẩm cấp: ${rodTier.label})\n` +
        `——————————————\n` +
        `📛 Tên: ${rod.name}\n` +
        (rod.stat ? `⚡ ${rod.statLabel}: ${rod.stat}\n` : "") +
        `📖 ${rod.desc}\n` +
        `——————————————\n` +
        (profile.rodLevel < MAX_ROD_LEVEL
          ? `Gõ "cauca muacan" để mua phẩm cấp kế tiếp: ${getRod(profile.rodLevel + 1).label} (${getRod(profile.rodLevel + 1).price.toLocaleString("en-US")} xu).`
          : "🏆 Bạn đã sở hữu phẩm cấp cần câu cao nhất — Tối Cao Thần Thoại (SSS)!");

      return api.sendMessage(caption, threadID, messageID);
    }

    // ---------------- KHO CÁ ----------------
    if (sub === "kho" || sub === "tui" || sub === "inventory") {
      const profile = Fishing.get(senderID);
      const items = Object.entries(profile.inventory || {});
      if (!items.length) {
        return api.sendMessage('🎒 Kho cá trống trơn. Gõ "cauca" để bắt đầu thả cần!', threadID, messageID);
      }

      let totalValue = 0;
      const lines = items.map(([name, qty]) => {
        const info = FISH_INDEX[name];
        const val = (info?.value || 0) * qty;
        totalValue += val;
        const tierEmoji = info ? TIERS[info.tier].emoji : "🗑️";
        return `${tierEmoji} ${name} x${qty} — ${info?.value ? `${(info.value * qty).toLocaleString("en-US")} xu` : "không bán được"}`;
      });

      const rodTier = getRod(profile.rodLevel);
      return api.sendMessage(
        `🎒 KHO CÁ CỦA BẠN (${rodTier.label} — ${profile.rod.name})\n` +
        `——————————————\n` +
        lines.join("\n") +
        `\n——————————————\n` +
        `💰 Tổng giá trị nếu bán hết: ${totalValue.toLocaleString("en-US")} xu\n` +
        `📊 Tổng số cá đã câu: ${profile.totalCatches}\n` +
        `Gõ "cauca ban" để bán hết lấy xu.`,
        threadID, messageID
      );
    }

    // ---------------- BÁN CÁ ----------------
    if (sub === "ban" || sub === "sell") {
      const profile = Fishing.get(senderID);
      const items = Object.entries(profile.inventory || {});
      const sellable = items.filter(([name]) => (FISH_INDEX[name]?.value || 0) > 0);

      if (!sellable.length) {
        return api.sendMessage('⚠️ Bạn chưa có con cá nào bán được. Gõ "cauca kho" để kiểm tra.', threadID, messageID);
      }

      let total = 0;
      const lines = sellable.map(([name, qty]) => {
        const val = FISH_INDEX[name].value * qty;
        total += val;
        return `• ${name} x${qty} — ${val.toLocaleString("en-US")} xu`;
      });

      Currencies.increaseMoney(senderID, total);
      Fishing.clearInventoryAndEarn(senderID, total);

      const newBalance = Currencies.getData(senderID).money;
      return api.sendMessage(
        `💰 ĐÃ BÁN TOÀN BỘ CÁ:\n${lines.join("\n")}\n` +
        `——————————————\n` +
        `Tổng nhận: +${total.toLocaleString("en-US")} xu\n` +
        `Số dư hiện tại: ${newBalance.toLocaleString("en-US")} xu`,
        threadID, messageID
      );
    }

    // ---------------- MUA CẦN CÂU ----------------
    if (sub === "muacan" || sub === "buy" || sub === "muacau" || sub === "capcan" || sub === "upgrade" || sub === "nangcap") {
      const profile = Fishing.get(senderID);
      if (profile.rodLevel >= MAX_ROD_LEVEL) {
        return api.sendMessage(
          `🏆 Bạn đã sở hữu cần câu phẩm cấp Tối Cao Thần Thoại (SSS): "${profile.rod.name}" — cao nhất trò chơi rồi!`,
          threadID, messageID
        );
      }

      const nextLevel = profile.rodLevel + 1;
      const nextTier = getRod(nextLevel);
      const balance = Currencies.getData(senderID).money;
      if (balance < nextTier.price) {
        return api.sendMessage(
          `⚠️ Không đủ xu để mua cần câu phẩm cấp ${nextTier.label}!\n` +
          `Cần: ${nextTier.price.toLocaleString("en-US")} xu — Bạn có: ${balance.toLocaleString("en-US")} xu.`,
          threadID, messageID
        );
      }

      Currencies.decreaseMoney(senderID, nextTier.price);
      const updated = Fishing.buyRod(senderID, nextLevel);
      const rod = updated.rod;

      const caption =
        `🎉 MUA THÀNH CÔNG cần câu phẩm cấp ${nextTier.label}!\n` +
        `——————————————\n` +
        `📛 Cần câu trúng: ${rod.name}\n` +
        (rod.stat ? `⚡ ${rod.statLabel}: ${rod.stat}\n` : "") +
        `📖 ${rod.desc}\n` +
        `——————————————\n` +
        `-${nextTier.price.toLocaleString("en-US")} xu (số dư còn: ${Currencies.getData(senderID).money.toLocaleString("en-US")} xu)\n` +
        `Tỉ lệ câu được cá quý đã tăng lên đáng kể!`;

      return api.sendMessage(caption, threadID, messageID);
    }

    // ---------------- BẢNG XẾP HẠNG ----------------
    if (sub === "bxh" || sub === "top" || sub === "rank") {
      const top = Fishing.getTopEarners(10);
      if (!top.length) {
        return api.sendMessage("📊 Chưa có ai bán cá lần nào cả. Hãy là người đầu tiên!", threadID, messageID);
      }

      const lines = [];
      let i = 1;
      for (const row of top) {
        const name = await getName(api, row.userID);
        lines.push(`${i}. ${name} — ${row.totalEarned.toLocaleString("en-US")} xu (${row.totalCatches} lần câu)`);
        i++;
      }

      return api.sendMessage(`🏆 BẢNG XẾP HẠNG NGƯ DÂN\n——————————————\n${lines.join("\n")}`, threadID, messageID);
    }

    // ---------------- THẢ CẦN (mặc định) ----------------
    const profile = Fishing.get(senderID);
    const now = Date.now();
    const remaining = CAST_COOLDOWN_MS - (now - (profile.lastCast || 0));
    if (remaining > 0) {
      return api.sendMessage(`⏳ Cần câu đang hồi, chờ thêm ${formatMs(remaining)} nữa nhé!`, threadID, messageID);
    }

    Fishing.set(senderID, { lastCast: now });
    const rodTier = getRod(profile.rodLevel);
    const rod = profile.rod;
    const result = castRod(profile.rodLevel);

    if (result.miss) {
      const caption =
        `🎣 Bạn thả cần... chờ đợi... 💦\n` +
        `😔 Hụt mất rồi, không có gì cắn câu cả. Thử lại sau ${Math.round(CAST_COOLDOWN_MS / 1000)} giây!`;
      return api.sendMessage(caption, threadID, messageID);
    }

    const tier = TIERS[result.tier];
    const isJunk = result.tier === "junk";
    const playerName = await getName(api, senderID);

    Fishing.addFish(senderID, result.fish.name); // rác vẫn lưu để hiện trong kho (giá trị 0)

    const valueText = result.fish.value > 0 ? `💰 Giá trị: ${result.fish.value.toLocaleString("en-US")} xu` : "💰 Không bán được";
    const weightText = result.weightKg != null ? `⚖️ Cân nặng: ${result.weightKg} kg` : "";
    const caption = isJunk
      ? `😖 Trời ơi, câu trúng "${result.fish.name}"! Vứt đi thôi...`
      : `🎉 ${playerName} câu được ${tier.emoji} ${result.fish.name} (${tier.label})!`;

    return api.sendMessage(
      `${caption}\n${weightText}\n${valueText}${rodStatLine(rod)}`,
      threadID, messageID
    );
  }
};
