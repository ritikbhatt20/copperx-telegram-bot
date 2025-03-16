import { createClient, RedisClientType } from "redis";
import { UserSession } from "../config";

export class RedisSessionManager {
  private client: RedisClientType;

  constructor() {
    const redisHost = process.env.REDIS_HOST || "localhost";
    const redisPort = process.env.REDIS_PORT || "6379";
    const redisPassword = process.env.REDIS_PASSWORD || undefined;
    const redisUrl = `redis://${redisHost}:${redisPort}`;

    this.client = createClient({
      url: redisUrl,
      password: redisPassword,
    });

    this.client.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
      console.log("Connected to Redis");
    } catch (err) {
      console.error("Failed to connect to Redis:", err);
    }
  }

  private serialize(value: any): string | undefined {
    return value ? JSON.stringify(value) : undefined;
  }

  private deserialize<T>(value: string | null): T | undefined {
    return value ? JSON.parse(value) : undefined;
  }

  async setSession(
    chatId: string,
    sessionData: Partial<UserSession>
  ): Promise<UserSession> {
    const existingSession = (await this.getSession(chatId)) || { chatId };
    const updatedSession: UserSession = { ...existingSession, ...sessionData };
    const key = `session:${chatId}`;
    await this.client.set(key, this.serialize(updatedSession) || "", {
      EX: 24 * 60 * 60,
    });
    return updatedSession;
  }

  async getSession(chatId: string): Promise<UserSession | undefined> {
    const key = `session:${chatId}`;
    const data = await this.client.get(key);
    if (!data) return undefined;
    const session = this.deserialize<UserSession>(data);
    if (!session) return undefined;
    session.chatId = chatId;
    if (session.otpRequestedAt) {
      session.otpRequestedAt = new Date(session.otpRequestedAt);
    }
    return session;
  }

  async deleteSession(chatId: string): Promise<boolean> {
    const key = `session:${chatId}`;
    const result = await this.client.del(key);
    return result > 0;
  }

  async isLoggedIn(chatId: string): Promise<boolean> {
    const session = await this.getSession(chatId);
    return !!(
      session &&
      session.accessToken &&
      session.loginState === "logged_in" &&
      session.expireAt &&
      new Date(session.expireAt) > new Date()
    );
  }

  async setLoginState(
    chatId: string,
    state: UserSession["loginState"]
  ): Promise<void> {
    const session = await this.getSession(chatId);
    if (session) {
      await this.setSession(chatId, { ...session, loginState: state });
    }
  }

  async setLastAction(chatId: string, action: string): Promise<void> {
    const session = await this.getSession(chatId);
    if (session) {
      await this.setSession(chatId, { ...session, lastAction: action });
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    console.log(
      "Redis handles expiration via TTL; manual cleanup not required."
    );
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    console.log("Disconnected from Redis");
  }
}
