import express from "express";
import TelegramBot from "node-telegram-bot-api";

const router = express.Router();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error(
    "Không tìm thấy TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong file .env",
  );
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false }); // polling: false để gửi tin nhắn thủ công

router.post("/send-newletter", (req, res) => {
  /*
                    #swagger.tags = ['Telegram']
                    #swagger.description = 'API to send newletter to telegram'
                    #swagger.parameters['newletter'] = {
                        in: 'body',
                        description: 'Newletter content',
                        required: true,
                        type: 'string',
                        schema: {
                            phoneNumber: '0123456789'
                        }
                    }
                 */

  const message = req.body.body;
  console.log("message:", message);
  bot
    .sendMessage(
      TELEGRAM_CHAT_ID,
      `Khách hàng này muốn nhận thông tin tư vấn:\n${message.phoneNumber}`,
    )
    .then(() => {
      console.log("Tin nhắn đã được gửi!");
      res.send("Tin nhắn đã được gửi thành công!");
    })
    .catch((error) => {
      console.error("Lỗi khi gửi tin nhắn:", error);
      res.send("Lỗi khi gửi tin nhắn!");
    });
  res.sendStatus(200);
});

router.post("/send-product-order", (req, res) => {
  /*
                    #swagger.tags = ['Telegram']
                    #swagger.description = 'API to send san-pham order to telegram'
                    #swagger.parameters['product'] = {
                        in: 'body',
                        description: 'Product information',
                        required: true,
                        type: 'object',
                        schema: {
                            product: {
                                name: 'product name',
                                id: 'san-pham id',
                            },
                            variantChosen: {
                                name: 'variant name',
                                id: 'variant id',
                            },
                            productPrice: 'product price',
                            info: {
                                email: 'email',
                                firstName: 'first name',
                                lastName: 'last name',
                                phoneNumber: 'phone number',
                                address: 'address',
                                specificAddress: 'specific address',
                                district: 'district',
                                city: 'city',
                                postcode: 'postcode',
                            }
                        }
                    }
                 */
  try {
    // console.log("req.body:", req.body.body);
    const { product, variantChosen, productPrice, info } = req.body.body;

    // console.log("san-pham:", san-pham);

    const message = `
        Đơn hàng mới:
        - Sản phẩm: ${product.name}
        - Biến thể: ${JSON.stringify(variantChosen)}
        - Giá: ${productPrice}đ
        - Thông tin liên hệ: 
            + Emaill: ${info.email}
            + Tên: ${info.firstName}
            + Họ: ${info.lastName}
            + Số điện thoại: ${info.phoneNumber}
            + Địa chỉ: ${info.address}
            + Địa chỉ cụ thể (nếu có): ${info.specificAddress}
            + Quận/Huyện: ${info.district}
            + Thành phố: ${info.city}
            + Mã bưu điện: ${info.postcode}
        `;

    bot
      .sendMessage(TELEGRAM_CHAT_ID, message)
      .then(() => {
        console.log("Tin nhắn đã được gửi!");
        res.send("Tin nhắn đã được gửi thành công!");
      })
      .catch((error) => {
        console.error("Lỗi khi gửi tin nhắn:", error);
        res.send("Lỗi khi gửi tin nhắn!");
      });
    res.sendStatus(200);
  } catch (e) {
    console.error("Error:", e);
    res.sendStatus(500);
  }
});

router.post("/send-cart-order", (req, res) => {
  try {
    const {
      address,
      city,
      district,
      email,
      firstName,
      lastName,
      phoneNumber,
      postcode,
      specificAddress,
      total,
      cart,
    } = req.body.body;

    // console.log(
    //   `Đơn hàng mới:` +
    //     `\n- Tổng tiền: ${total}đ` +
    //     `\n- Thông tin liên hệ:` +
    //     `\n  + Email: ${email}` +
    //     `\n  + Tên: ${firstName}` +
    //     `\n  + Họ: ${lastName}` +
    //     `\n  + Số điện thoại: ${phoneNumber}` +
    //     `\n  + Địa chỉ: ${address}` +
    //     `\n  + Địa chỉ cụ thể: ${specificAddress}` +
    //     `\n  + Quận/Huyện: ${district}` +
    //     `\n  + Thành phố: ${city}` +
    //     `\n  + Mã bưu điện: ${postcode}`,
    // );

    let textCart = "";
    const cleanedCart = cart.forEach((item:any) => {
        textCart += `\n  + ${item.name} - ${JSON.stringify(item.variants)} x ${item.quantity}`;
    });


    // console.log("cart:", cleanedCart);

    const message = `
        Đơn hàng mới:
        - Tổng tiền: ${total}đ
        - Thông tin liên hệ: 
            + Email: ${email}
            + Tên: ${firstName}
            + Họ: ${lastName}
            + Số điện thoại: ${phoneNumber}
            + Địa chỉ: ${address}
            + Địa chỉ cụ thể: ${specificAddress}
            + Quận/Huyện: ${district}
            + Thành phố: ${city}
            + Mã bưu điện: ${postcode}
        - Sản phẩm: ${textCart}
       `;
    // console.log("message:", message);
    bot
      .sendMessage(TELEGRAM_CHAT_ID, message)
      .then(() => {
        console.log("Tin nhắn đã được gửi!");
        res.send("Tin nhắn đã được gửi thành công!");
      })
      .catch((error) => {
        console.error("Lỗi khi gửi tin nhắn:", error);
        res.send("Lỗi khi gửi tin nhắn!");
      });
    res.sendStatus(200);
  } catch (e) {
    console.error("Error:", e);
    res.sendStatus(500);
  }
});
export default router;
