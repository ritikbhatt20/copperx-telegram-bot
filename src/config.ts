export const CONFIG = {
  COPPERX_API_BASE_URL: "https://income-api.copperx.io",
  SUPPORT_LINK: "https://t.me/copperxcommunity/2183",
};

export interface UserSession {
  email: string;
  sid?: string;
  accessToken?: string;
  expireAt?: string;
}
