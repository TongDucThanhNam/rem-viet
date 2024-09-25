import express from 'express';
import morgan from 'morgan';
import productRoutes from './Api/Routes/ProductRoutes';
import 'dotenv/config';

const TelegramBot = require('node-telegram-bot-api');

const swaggerUi = require('swagger-ui-express');

const swaggerFile = require('./swagger_output.json');

const PORT = process.env.PORT;
const app = express()

app.use(morgan("dev"));

if (express.json) {
    app.use(express.json());
} else {
    console.error("express.json() is not available");
}

//product
app.use("/api", productRoutes);

app.use("/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerFile)
);

app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false}); // polling: false để gửi tin nhắn thủ công

app.post('/api/send-newletter', (req, res) => {
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


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})