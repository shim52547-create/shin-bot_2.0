"use strict";

const path = require("path");
const { Readable } = require("stream");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const { Currencies } = require("../utils/currency");

const MIN_BET = 50;
const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  try {
    GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Bold.ttf"), "Poppins Bold");
    GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Medium.ttf"), "Poppins Medium");
    GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Regular.ttf"), "Poppins Regular");
  } catch (e) {
    console.warn("[xocdia] Không load được font Poppins, dùng font mặc định:", e.message);
  }
}

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Lắc 4 đồng xu, mỗi đồng 50/50 ra mặt đỏ hoặc trắng
function shakeCoins() {
  const coins = [1, 2, 3, 4].map(() => (Math.random() < 0.5 ? "do" : "trang"));
  const soDo = coins.filter(c => c === "do").length;
  return { coins, soDo };
}

// Hệ số thưởng theo kiểu "bao" (đoán đúng số lượng mặt đỏ trong 4 đồng)
// Xác suất: 0 đỏ hoặc 4 đỏ = 1/16 mỗi loại (hiếm, trả cao)
//           1 đỏ hoặc 3 đỏ = 4/16 mỗi loại (trả vừa)
//           2 đỏ            = 6/16 (phổ biến nhất, trả thấp)
const BAO_MULT = { 0: 9, 1: 3, 2: 2, 3: 3, 4: 9 };

function drawPlate({ coins, resultText, subText }) {
  ensureFonts();
  const W = 800, H = 650;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Nền
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#3a0d0d");
  bg.addColorStop(1, "#150404");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Tiêu đề
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd76a";
  ctx.font = "bold 46px 'Poppins Bold'";
  ctx.fillText("XÓC ĐĨA", W / 2, 70);

  // Cái đĩa (đáy)
  const plateX = W / 2, plateY = 330, plateR = 230;
  const plateGrad = ctx.createRadialGradient(plateX, plateY - 30, 30, plateX, plateY, plateR);
  plateGrad.addColorStop(0, "#5b3a1e");
  plateGrad.addColorStop(1, "#2e1c0d");
  ctx.beginPath();
  ctx.ellipse(plateX, plateY, plateR, plateR * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = plateGrad;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#7a4e26";
  ctx.stroke();

  // Cái bát úp (viền tròn phía trong, mang tính trang trí)
  ctx.beginPath();
  ctx.ellipse(plateX, plateY, plateR * 0.78, plateR * 0.42, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // 4 đồng xu xếp 2x2 chính giữa đĩa
  const coinR = 62;
  const positions = [
    { x: plateX - 90, y: plateY - 55 },
    { x: plateX + 90, y: plateY - 55 },
    { x: plateX - 90, y: plateY + 55 },
    { x: plateX + 90, y: plateY + 55 }
  ];

  coins.forEach((c, i) => {
    const { x, y } = positions[i];
    const isDo = c === "do";

    // Bóng đổ
    ctx.beginPath();
    ctx.ellipse(x, y + coinR * 0.75, coinR * 0.9, coinR * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();

    // Thân đồng xu
    const coinGrad = ctx.createRadialGradient(x - 15, y - 15, 8, x, y, coinR);
    if (isDo) {
      coinGrad.addColorStop(0, "#ff6b5e");
      coinGrad.addColorStop(1, "#c81d1d");
    } else {
      coinGrad.addColorStop(0, "#ffffff");
      coinGrad.addColorStop(1, "#c9ccd1");
    }
    ctx.beginPath();
    ctx.arc(x, y, coinR, 0, Math.PI * 2);
    ctx.fillStyle = coinGrad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = isDo ? "#7a0f0f" : "#8a8f98";
    ctx.stroke();

    // Vòng tròn lỗ đồng xu ở giữa (kiểu tiền cổ)
    ctx.beginPath();
    ctx.arc(x, y, coinR * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = isDo ? "#7a0f0f" : "#9aa0a8";
    ctx.fill();
  });

  // Kết quả
  ctx.font = "bold 34px 'Poppins Bold'";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(resultText, W / 2, 560);

  ctx.font = "26px 'Poppins Medium'";
  ctx.fillStyle = "#ffe9b3";
  ctx.fillText(subText, W / 2, 605);

  return canvas.toBuffer("image/png");
}

module.exports = {
  config: {
    name: "xocdia",
    aliases: ["xd"],
    version: "1.0",
    role: 0,
    description: "Chơi xóc đĩa bằng xu ảo, có hình ảnh đĩa và 4 đồng xu đỏ/trắng",
    usage:
      "xocdia <chan/le> <số xu>\n" +
      "xocdia bao <0-4> <số xu>  (đoán đúng số mặt đỏ, thưởng cao hơn)",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;

    if (!args[0] || !args[1]) {
      return api.sendMessage(
        `⚠️ Cách dùng:\n` +
          `- xocdia <chan/le> <số xu>\n` +
          `- xocdia bao <0-4> <số xu>\n` +
          `(tối thiểu ${MIN_BET} xu)`,
        threadID, messageID
      );
    }

    const first = normalize(args[0]);
    let mode, guessNumber = null, betArg;

    if (first === "bao") {
      if (!args[1] || !args[2]) {
        return api.sendMessage("⚠️ Cách dùng: xocdia bao <0-4> <số xu>", threadID, messageID);
      }
      guessNumber = parseInt(args[1], 10);
      if (isNaN(guessNumber) || guessNumber < 0 || guessNumber > 4) {
        return api.sendMessage("⚠️ Số đỏ đoán phải từ 0 đến 4.", threadID, messageID);
      }
      mode = "bao";
      betArg = args[2];
    } else if (first === "chan" || first === "le") {
      mode = first;
      betArg = args[1];
    } else {
      return api.sendMessage("⚠️ Chỉ đặt cược chẵn, lẻ, hoặc bao <0-4>.", threadID, messageID);
    }

    const bet = parseInt(betArg, 10);
    if (isNaN(bet) || bet < MIN_BET) {
      return api.sendMessage(`⚠️ Mức cược không hợp lệ (tối thiểu ${MIN_BET} xu).`, threadID, messageID);
    }

    const moneyUser = Currencies.getData(senderID).money;
    if (moneyUser < bet) {
      return api.sendMessage(`⚡ Số dư của bạn không đủ ${bet} xu để chơi.`, threadID, messageID);
    }

    const { coins, soDo } = shakeCoins();
    const isChan = soDo % 2 === 0;

    Currencies.decreaseMoney(senderID, bet);

    let win = false, payout = 0, ketQuaLine;

    if (mode === "bao") {
      win = soDo === guessNumber;
      if (win) payout = bet * BAO_MULT[soDo];
      ketQuaLine = `Bạn bao ${guessNumber} đỏ`;
    } else {
      const ketQuaChanLe = isChan ? "chan" : "le";
      win = ketQuaChanLe === mode;
      if (win) payout = bet * 2;
      ketQuaLine = `Bạn đặt ${mode === "chan" ? "Chẵn" : "Lẻ"}`;
    }

    if (win) Currencies.increaseMoney(senderID, payout);

    const resultText = `Kết quả: ${soDo} Đỏ - ${4 - soDo} Trắng (${isChan ? "Chẵn" : "Lẻ"})`;
    const subText = win
      ? `✅ ${ketQuaLine} — Thắng ${payout} xu!`
      : `❌ ${ketQuaLine} — Mất ${bet} xu.`;

    try {
      const buffer = drawPlate({ coins, resultText, subText });
      const imgStream = new Readable({
        read() {
          this.push(buffer);
          this.push(null);
        }
      });
      imgStream.path = `xocdia_${senderID}_${Date.now()}.png`;

      return api.sendMessage({ attachment: imgStream }, threadID, messageID);
    } catch (e) {
      console.error("[xocdia] Lỗi tạo ảnh, dùng bản text dự phòng:", e);
      return api.sendMessage(`🎲 ${resultText}\n${subText}`, threadID, messageID);
    }
  }
};
