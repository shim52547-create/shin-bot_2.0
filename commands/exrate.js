const axios = require("axios");

module.exports = {
  config: {
    name: "exrate",
    aliases: ["quydoi", "tigia"],
    version: "1.0",
    role: 0,
    description: "Quy đổi tiền tệ thế giới theo tỷ giá thực tế",
    usage: "exrate <số tiền> <từ_tiền> <sang_tiền>\nVí dụ: exrate 100 USD VND",
    category: "Tiện ích"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    // Kiểm tra cú pháp nhập vào
    if (args.length !== 3) {
      return api.sendMessage(
        "⚠️ Cú pháp sai!\n👉 Cách dùng: exrate <số tiền> <từ_tiền> <sang_tiền>\n💡 Ví dụ: exrate 100 USD VND hoặc exrate 5000000 VND EUR",
        threadID, messageID
      );
    }

    const amount = parseFloat(args[0]);
    const fromCurrency = args[1].toLowerCase(); // API yêu cầu chữ thường (vd: usd, vnd)
    const toCurrency = args[2].toLowerCase();

    if (isNaN(amount) || amount <= 0) {
      return api.sendMessage("⚠️ Số tiền phải là một số lớn hơn 0.", threadID, messageID);
    }

    // Danh sách các ký hiệu tiền tệ phổ biến để hiển thị cho đẹp
    const symbols = {
      usd: "$", eur: "€", gbp: "£", jpy: "¥", krw: "₩", 
      vnd: "₫", cny: "¥", thb: "฿", rub: "₽", inr: "₹"
    };

    api.sendMessage("⏳ Đang lấy tỷ giá từ ngân hàng quốc tế...", threadID, messageID);

    try {
      // Gọi API miễn phí từ jsDelivr CDN (Cập nhật hàng ngày, không bao giờ lỗi mạng trên Render)
      const res = await axios.get(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${fromCurrency}.json`);
      
      const rates = res.data[fromCurrency];
      
      if (!rates || !rates[toCurrency]) {
        return api.sendMessage("❌ Mã tiền tệ không hợp lệ. Vui lòng kiểm tra lại (ví dụ: USD, VND, EUR, JPY...).", threadID, messageID);
      }

      const rate = rates[toCurrency];
      const result = amount * rate;

      // Hàm định dạng số thành chuỗi có dấu phẩy ngăn cách hàng nghìn (vd: 1,000,000.00)
      const formatNumber = (num) => {
        return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const fromSymbol = symbols[fromCurrency] || fromCurrency.toUpperCase();
      const toSymbol = symbols[toCurrency] || toCurrency.toUpperCase();

      // Tạo tin nhắn kết quả
      const msg = 
        `💱 **BẢNG TỶ GIÁ HỐI ĐOÁI**\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `🔹 Số tiền: ${formatNumber(amount)} ${fromCurrency.toUpperCase()}\n` +
        `🔸 Tỷ giá: 1 ${fromCurrency.toUpperCase()} = ${formatNumber(rate)} ${toCurrency.toUpperCase()}\n` +
        `➡️ Kết quả: **${formatNumber(result)} ${toCurrency.toUpperCase()}** (${toSymbol})\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `📅 Ngày cập nhật: ${res.data.date}`;

      return api.sendMessage(msg, threadID, messageID);

    } catch (err) {
      console.error("Lỗi lệnh exrate:", err.message);
      return api.sendMessage("❌ Không thể kết nối đến máy chủ tỷ giá. Thử lại sau nhé!", threadID, messageID);
    }
  }
};
