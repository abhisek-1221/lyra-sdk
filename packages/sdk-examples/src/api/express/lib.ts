import { config } from "dotenv";

config();

import { yt } from "lyra-sdk";

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("YOUTUBE_API_KEY is required");
  process.exit(1);
}

export const client = yt(API_KEY);
