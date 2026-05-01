import { getChannelTool, getChannelVideosTool } from "./tools/channel.js";
import { getCommentsTool, getTopCommentsTool, searchCommentsTool } from "./tools/comment.js";
import { getPlaylistInfoTool, getPlaylistTool, getPlaylistVideosTool } from "./tools/playlist.js";
import { batchTranscribeTool, transcribeVideoTool } from "./tools/transcript.js";
import { getVideosTool, getVideoTool } from "./tools/video.js";
import type { AIToolsConfig, ToolDefinition } from "./types.js";

export function createAITools(config: AIToolsConfig) {
  return {
    getVideo: getVideoTool(config),
    getVideos: getVideosTool(config),
    getChannel: getChannelTool(config),
    getChannelVideos: getChannelVideosTool(config),
    getPlaylist: getPlaylistTool(config),
    getPlaylistInfo: getPlaylistInfoTool(config),
    getPlaylistVideos: getPlaylistVideosTool(config),
    getComments: getCommentsTool(config),
    getTopComments: getTopCommentsTool(config),
    searchComments: searchCommentsTool(config),
    transcribeVideo: transcribeVideoTool(config),
    batchTranscribe: batchTranscribeTool(config),
  };
}

export type AITools = ReturnType<typeof createAITools>;
export type AIToolName = keyof AITools;
export type AIToolDefinition = ToolDefinition;
