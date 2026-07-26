const COMMENTS = {
  high: [
    "Cặp đôi vàng, đẹp như phim ngôn tình 🌟",
    "Hợp đến mức ông trời cũng phải gật gù 😌",
    "Cứ thế mà tiến tới thôi, chần chừ gì nữa 💍"
  ],
  mid: [
    "Cũng ổn áp, cần thêm chút thời gian tìm hiểu 🌱",
    "Có duyên nhưng cần cả hai cùng cố gắng 🤝",
    "50/50 vậy chứ biết đâu lại thành đôi bền vững 🍀"
  ],
  low: [
    "Thôi làm bạn tốt cho lành 😅",
    "Trời sinh ra hai người chắc là để... troll nhau thôi 🤣",
    "Số này hợp làm đối thủ hơn là hợp làm người yêu 😂"
  ]
};

// Hash đơn giản để cùng 1 cặp tên luôn ra cùng 1 kết quả (khỏi bị nói là bot ghi đè)
function hashPair(a, b) {
  const str = [a, b].sort().join("|").toLowerCase();
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

module.exports = {
  config: {
    name: "boi",
    aliases: ["boitinh", "boitinhyeu"],
    version: "1.0",
    role: 0,
    description: "Bói tình yêu vui giữa 2 người (không mang tính khoa học, chỉ để giải trí)",
    usage: "boi <tên 1> - <tên 2>",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const content = args.join(" ");
    const dashIndex = content.indexOf(" - ");

    if (dashIndex === -1) {
      return api.sendMessage("⚠️ Cách dùng: boi <tên 1> - <tên 2>\nVí dụ: boi Nam - Lan", threadID, messageID);
    }

    const nameA = content.substring(0, dashIndex).trim();
    const nameB = content.substring(dashIndex + 3).trim();

    if (!nameA || !nameB) {
      return api.sendMessage("⚠️ Cần nhập đủ 2 tên. Ví dụ: boi Nam - Lan", threadID, messageID);
    }

    const percent = hashPair(nameA, nameB) % 101; // 0-100

    let tier = "low";
    if (percent >= 75) tier = "high";
    else if (percent >= 40) tier = "mid";

    const list = COMMENTS[tier];
    const comment = list[hashPair(nameA, nameB) % list.length];

    const body =
      `🔮 KẾT QUẢ BÓI TÌNH YÊU 🔮\n\n` +
      `${nameA}  💕  ${nameB}\n` +
      `Tỉ lệ hợp nhau: ${percent}%\n\n` +
      `${comment}\n\n` +
      `(Chỉ mang tính giải trí, đừng "seed" nghiêm túc nha 😆)`;

    return api.sendMessage(body, threadID, messageID);
  }
};
