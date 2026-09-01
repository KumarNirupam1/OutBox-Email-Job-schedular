import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from './lib/auth.js';
import cors from "cors";

const app = express();
const port = process.env.PORT ?? 8080;
const clientUrl = process.env.CLIENT_URL ?? "https://localhost:3000";

app.use(
    cors({
        origin : clientUrl,
        credentials:true,
    })
)

app.all('/api/auth/{*any}', toNodeHandler(auth));



app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Hello" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server running on <http://localhost>:${port}`);
});