export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

export const RE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export const RE_BCP47_LANG = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

export const INNERTUBE_CLIENT_NAME = "ANDROID";
export const INNERTUBE_CLIENT_VERSION = "20.10.38";

export const DEFAULT_CACHE_TTL = 3_600_000;
export const DEFAULT_RETRY_DELAY = 1_000;
