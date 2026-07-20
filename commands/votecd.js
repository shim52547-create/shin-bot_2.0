// state theo nhóm: { title, options: [{label, votes: Set(userID)}], timer, endAt }
const active = new Map();

function buildStatus(game, done) {
  const total = game.options.reduce((s, o) => s + o.votes.size, 0);
  let body = done ? `🏁 KẾT QUẢ BÌNH CHỌN: ${game.title}\n\n` : `📊 ĐANG BÌNH CHỌN: ${game.title}\n\n`;
  game.options.forEach((o, i) => {
    const pct = total ? Math.round((o.votes.size / total) * 100) : 0;
    body += `${i + 1}. ${o.label} — ${o.votes.size} phiếu (${pct}%)\n`;
  });
  body += `\nTổng lượt: ${total}`;
  if (!done) body += `\nVote bằng lệnh: votecd chon <số>`;
  return body;
}

module.exports = {
  config: {
    name: "votecd",
    aliases: ["binhchoncd", "votehengio"],
    version: "1.0",
    role: 0,
    description: "Tạo bình chọn có đếm giờ, tự động công bố kết quả khi hết giờ",
    usage: "votecd <số phút> <tiêu đề> -> [lựa chọn 1 | lựa chọn 2 | ...]\nvotecd chon <số>",
    category: "Group"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const sub = args[0]?.toLowerCase();

    if (sub === "chon" || sub === "vote") {
      const game = active.get(threadID);
      if (!game) return api.sendMessage("⚠️ Hiện không có bình chọn nào đang diễn ra.", threadID, messageID);

      const idx = parseInt(args[1], 10) - 1;
      if (isNaN(idx) || !game.options[idx]) {
        return api.sendMessage(`⚠️ Chọn số từ 1 đến ${game.options.length}.`, threadID, messageID);
      }

      // Mỗi người chỉ được giữ 1 lựa chọn tại 1 thời điểm, chọn lại thì đổi phiếu
      for (const o of game.options) o.votes.delete(senderID);
      game.options[idx].votes.add(senderID);

      return api.sendMessage(`✅ Đã ghi nhận phiếu cho: ${game.options[idx].label}`, threadID, messageID);
    }

    if (active.has(threadID)) {
      return api.sendMessage(buildStatus(active.get(threadID), false), threadID, messageID);
    }

    const content = args.join(" ");
    const arrowIndex = content.indexOf(" -> ");
    if (arrowIndex === -1) {
      return api.sendMessage(
        "⚠️ Cách dùng: votecd <số phút> <tiêu đề> -> [lựa chọn 1 | lựa chọn 2 | ...]\nVí dụ: votecd 5 Ăn gì tối nay -> [Lẩu | Nướng | Pizza]",
        threadID, messageID
      );
    }

    const head = content.substring(0, arrowIndex).trim();
    const optionsRaw = content.substring(arrowIndex + 4).trim().replace(/^\[|\]$/g, "");
    const options = optionsRaw.split("|").map(o => o.trim()).filter(Boolean);

    const headParts = head.split(" ");
    const minutes = parseInt(headParts[0], 10);
    const title = headParts.slice(1).join(" ").trim();

    if (!minutes || minutes <= 0 || minutes > 180) {
      return api.sendMessage("⚠️ Số phút không hợp lệ (tối đa 180 phút).", threadID, messageID);
    }
    if (!title || options.length < 2) {
      return api.sendMessage("⚠️ Cần có tiêu đề và ít nhất 2 lựa chọn (cách nhau bởi '|').", threadID, messageID);
    }

    const game = {
      title,
      options: options.map(label => ({ label, votes: new Set() })),
      endAt: Date.now() + minutes * 60 * 1000
    };

    game.timer = setTimeout(() => {
      const g = active.get(threadID);
      if (!g) return;
      api.sendMessage(buildStatus(g, true), threadID);
      active.delete(threadID);
    }, minutes * 60 * 1000);

    active.set(threadID, game);

    return api.sendMessage(
      `${buildStatus(game, false)}\n\n⏳ Kết quả sẽ được công bố tự động sau ${minutes} phút.`,
      threadID, messageID
    );
  }
};
