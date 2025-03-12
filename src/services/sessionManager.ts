import { UserSession } from "../config";

// In-memory session store
class SessionManager {
  private sessions: Map<string, UserSession> = new Map();

  // Create or update session
  setSession(chatId: string, sessionData: Partial<UserSession>): UserSession {
    const existingSession = this.getSession(chatId) || { chatId };
    const updatedSession = { ...existingSession, ...sessionData };
    this.sessions.set(chatId, updatedSession);
    return updatedSession;
  }

  // Get session
  getSession(chatId: string): UserSession | undefined {
    return this.sessions.get(chatId);
  }

  // Delete session
  deleteSession(chatId: string): boolean {
    return this.sessions.delete(chatId);
  }

  // Check if user is logged in
  isLoggedIn(chatId: string): boolean {
    const session = this.getSession(chatId);
    return !!(
      session &&
      session.accessToken &&
      session.loginState === "logged_in" &&
      session.expireAt &&
      new Date(session.expireAt) > new Date()
    );
  }

  // Set login state
  setLoginState(chatId: string, state: UserSession["loginState"]): void {
    const session = this.getSession(chatId);
    if (session) {
      this.setSession(chatId, { ...session, loginState: state });
    }
  }

  // Update last action
  setLastAction(chatId: string, action: string): void {
    const session = this.getSession(chatId);
    if (session) {
      this.setSession(chatId, { ...session, lastAction: action });
    }
  }
}

export const sessionManager = new SessionManager();
