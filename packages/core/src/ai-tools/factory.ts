import type { AIToolsConfig, ToolDefinition } from "./types.js";
import { getVideoTool, getVideosTool } from "./tools/video.js";
import { getChannelTool, getChannelVideosTool } from "./tools/channel.js";
import {
  getPlaylistTool,
  getPlaylistInfoTool,
  getPlaylistVideosTool,
} from "./tools/playlist.js";
import {
  getCommentsTool,
  getTopCommentsTool,
  searchCommentsTool,
} from "./tools/comment.js";
import {
  transcribeVideoTool,
  batchTranscribeTool,
} from "./tools/transcript.js";

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
