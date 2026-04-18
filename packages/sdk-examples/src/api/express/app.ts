import express from "express";
import { apiError } from "./errors.js";
import { routes } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use("/api", routes());

  app.use(apiError);

  return app;
}
