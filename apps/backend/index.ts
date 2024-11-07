import express from "express";
import morgan from "morgan";
import productRoutes from "./Api/Routes/ProductRoutes";
import telegramRoutes from "./Api/Routes/TelegramRoutes";
import postRoutes from "./Api/Routes/PostRoutes.ts";
import cors from "cors";
import "dotenv/config";

import swaggerUi from "swagger-ui-express";

import swaggerFile from "./swagger_output.json";

const PORT = process.env.PORT;
const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use(cors());

//san-pham
app.use("/api", productRoutes);
app.use("/api", telegramRoutes);
app.use("/api", postRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

//error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});
