import { config } from "dotenv";
config();

import { yt } from "../packages/core/src/index.js";

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) {
  console.error("Error: YOUTUBE_API_KEY not set in environment");
  process.exit(1);
}

const client = yt(apiKey);
const videoId = process.argv[2] ?? "dQw4w9WgXcQ";

async function main() {
  console.log("=== Comments ===\n");
  console.log(`Video: ${videoId}\n`);

  console.log("--- Top Comments (relevance) ---\n");
  const top = await client.topComments(videoId, 5);

  for (const t of top) {
    const likes = t.topLevelComment.likeCount;
    console.log(`  @${t.topLevelComment.authorName} (${likes} likes)`);
    console.log(`    "${t.topLevelComment.text}"`);
    if (t.totalReplyCount > 0) {
      console.log(`    └─ ${t.totalReplyCount} repl${t.totalReplyCount === 1 ? "y" : "ies"}`);
    }
  }

  console.log("\n--- Comment Stats ---\n");
  const threads = await client.comments(videoId, { maxResults: 50 });
  const stats = client.commentStats(videoId, threads);

  console.log(`  Total threads:    ${stats.totalComments}`);
  console.log(`  Total replies:    ${stats.totalReplies}`);
  console.log(`  Unique authors:   ${stats.uniqueAuthors}`);
  console.log(`  Avg likes:        ${stats.avgLikes}`);
  console.log(`  Reply ratio:      ${stats.replyRatio}`);
  if (stats.mostLikedComment) {
    console.log(`  Most liked:       @${stats.mostLikedComment.authorName} (${stats.mostLikedComment.likeCount} likes)`);
    console.log(`                    "${stats.mostLikedComment.text}"`);
  }

  console.log("\n--- Search Comments ---\n");
  const results = await client.searchComments(videoId, "love");
  console.log(`  Found ${results.length} threads matching "love"`);

  console.log("\n--- Comment Query Builder ---\n");
  const queryResult = await client
    .commentQuery(videoId)
    .order("relevance")
    .limit(3)
    .execute();

  console.log(`  Threads: ${queryResult.threads.length}`);
  console.log(`  Stats: ${queryResult.stats.totalComments} comments, ${queryResult.stats.uniqueAuthors} authors`);
}

main().catch(console.error);
