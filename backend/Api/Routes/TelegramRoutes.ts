import express from "express";
import TelegramBot from 'node-telegram-bot-api';

const router = express.Router();


const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Không tìm thấy TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong file .env');
    process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false}); // polling: false để gửi tin nhắn thủ công

router.post('/send-newletter', (
    req,
    res
) => {
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

    const message = req.body;
    bot.sendMessage(TELEGRAM_CHAT_ID, `Khách hàng này muốn nhận thông tin tư vấn:\n${message.phoneNumber}`)
        .then(() => {
            console.log('Tin nhắn đã được gửi!');
            res.send('Tin nhắn đã được gửi thành công!');
        })
        .catch((error) => {
            console.error('Lỗi khi gửi tin nhắn:', error);
            res.send('Lỗi khi gửi tin nhắn!');
        });
    res.sendStatus(200);
});

router.post('/send-product-order', (req, res) => {
    /*
        #swagger.tags = ['Telegram']
        #swagger.description = 'API to send product order to telegram'
        #swagger.parameters['product'] = {
            in: 'body',
            description: 'Product information',
            required: true,
            type: 'object',
            schema: {
                product: {
                    name: 'product name',
                    id: 'product id',
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

    const {
        product,
        variantChosen,
        productPrice,
        info,
    } = req.body;

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


    bot.sendMessage(TELEGRAM_CHAT_ID, message)
        .then(() => {
            console.log('Tin nhắn đã được gửi!');
            res.send('Tin nhắn đã được gửi thành công!');
        })
        .catch((error) => {
            console.error('Lỗi khi gửi tin nhắn:', error);
            res.send('Lỗi khi gửi tin nhắn!');
        });
    res.sendStatus(200);
});

export default router;