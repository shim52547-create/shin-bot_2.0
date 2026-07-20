const { Currencies } = require("../utils/currency");

const QUESTIONS = [
  { q: "Thủ đô của Việt Nam là gì?", a: ["hà nội"] },
  { q: "1 tuần có bao nhiêu ngày?", a: ["7", "bảy"] },
  { q: "Con vật nào được mệnh danh là chúa sơn lâm?", a: ["hổ", "con hổ"] },
  { q: "Nước chiếm bao nhiêu % diện tích bề mặt Trái Đất (làm tròn)?", a: ["71", "71%"] },
  { q: "Ai là tác giả của truyện Kiều?", a: ["nguyễn du"] },
  { q: "1 giờ có bao nhiêu phút?", a: ["60", "sáu mươi"] },
  { q: "Hành tinh nào gần Mặt Trời nhất?", a: ["sao thủy"] },
  { q: "Việt Nam có bao nhiêu tỉnh/thành trước sáp nhập 2025 (63 hoặc số hiện hành)?", a: ["63"] },
  { q: "Loài chim nào được xem là biểu tượng hòa bình?", a: ["chim bồ câu", "bồ câu"] },
  { q: "Kim loại nào nhẹ nhất trong các kim loại phổ biến, ký hiệu Li?", a: ["liti", "lithium"] }
];

const REWARD = 50;
const TIMEOUT_MS = 45 * 1000;

// state theo nhóm: { question, answers, timer }
const active = new Map();

function normalize(str) {
  return str.trim().toLowerCase();
}

module.exports = {
  config: {
    name: "dovui",
    aliases: ["quiz", "trac nghiem"],
    version: "1.0",
    role: 0,
    description: "Trả lời câu đố nhanh để nhận thưởng xu",
    usage: "dovui | dovui tl <câu trả lời>",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const sub = args[0]?.toLowerCase();

    if (sub === "tl" || sub === "traloi") {
      const game = active.get(threadID);
      if (!game) return api.sendMessage('⚠️ Hiện chưa có câu đố nào. Gõ "dovui" để lấy câu hỏi mới.', threadID, messageID);

      const answer = normalize(args.slice(1).join(" "));
      if (!answer) return api.sendMessage("⚠️ Cách dùng: dovui tl <câu trả lời>", threadID, messageID);

      if (game.answers.includes(answer)) {
        clearTimeout(game.timer);
        active.delete(threadID);
        const newBalance = Currencies.increaseMoney(senderID, REWARD);
        return api.sendMessage(`🎉 Chính xác! +${REWARD} xu (số dư: ${newBalance})`, threadID, messageID);
      }
      return api.sendMessage("❌ Chưa đúng, thử lại xem nào!", threadID, messageID);
    }

    if (active.has(threadID)) {
      const g = active.get(threadID);
      return api.sendMessage(`❓ Câu đố hiện tại: ${g.question}\nTrả lời bằng: dovui tl <đáp án>`, threadID, messageID);
    }

    const picked = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    const timer = setTimeout(() => {
      api.sendMessage(`⏰ Hết giờ! Đáp án là: ${picked.a[0]}`, threadID);
      active.delete(threadID);
    }, TIMEOUT_MS);

    active.set(threadID, { question: picked.q, answers: picked.a.map(normalize), timer });

    return api.sendMessage(
      `❓ ĐỐ VUI (${TIMEOUT_MS / 1000}s)\n\n${picked.q}\n\nTrả lời bằng: dovui tl <đáp án>\nĐúng đầu tiên nhận +${REWARD} xu!`,
      threadID, messageID
    );
  }
};
