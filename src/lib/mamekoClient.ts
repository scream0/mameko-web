/**
 * src/lib/mamekoClient.ts
 *
 * MAMEKO NATIVE CLIENT (Adapter Pattern)
 * Arsitektur mandiri: Go Fiber Backend + Docker Postgres + Native WebSocket.
 * Menggantikan dependensi cloud lama dengan antarmuka native yang aman dan mandiri.
 */

import { getApiBaseUrl } from "./apiClient.ts";

export interface UserProfile {
  id: string;
  uid?: string;
  email: string;
  full_name?: string;
  username?: string;
  role?: string;
  status?: string;
  avatar_url?: string;
  phone?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface Session {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: UserProfile;
}

type AuthChangeCallback = (event: string, session: Session | null) => void;

export class NativeAuthClient {
  private listeners: Set<AuthChangeCallback> = new Set();
  private currentSession: Session | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadSessionFromStorage();
    }
  }

  private loadSessionFromStorage(): Session | null {
    try {
      const storedToken =
        localStorage.getItem("mameko_access_token") ||
        localStorage.getItem("sb-access-token");
      const storedUser = localStorage.getItem("mameko_user");

      if (storedToken && storedUser) {
        const user = JSON.parse(storedUser);
        const refreshToken =
          localStorage.getItem("mameko_refresh_token") || undefined;
        this.currentSession = {
          access_token: storedToken,
          refresh_token: refreshToken,
          user: {
            ...user,
            user_metadata: {
              full_name: user.full_name || user.name,
              name: user.full_name || user.name,
              avatar_url: user.avatar_url,
              role: user.role,
            },
            app_metadata: {
              role: user.role,
              provider: "native",
            },
          },
        };
        return this.currentSession;
      }
    } catch (e) {
      console.warn("[AuthClient] Error loading stored session:", e);
    }
    this.currentSession = null;
    return null;
  }

  private saveSession(session: Session | null) {
    this.currentSession = session;
    if (typeof window === "undefined") return;

    try {
      if (session) {
        localStorage.setItem("mameko_access_token", session.access_token);
        if (session.refresh_token) {
          localStorage.setItem("mameko_refresh_token", session.refresh_token);
        }
        localStorage.setItem("mameko_user", JSON.stringify(session.user));

        // Set document cookie untuk kompatibilitas SSR / Middleware
        const maxAge = 60 * 60 * 24 * 7; // 7 hari
        document.cookie = `mameko_access_token=${session.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;
        SharedRealtimeSocket.getInstance().reconnectWithToken(session.access_token);
      } else {
        localStorage.removeItem("mameko_access_token");
        localStorage.removeItem("sb-access-token");
        localStorage.removeItem("mameko_refresh_token");
        localStorage.removeItem("mameko_user");

        // Clear cookies
        document.cookie = "sb-access-token=; path=/; max-age=0";
        document.cookie = "mameko_access_token=; path=/; max-age=0";
        SharedRealtimeSocket.getInstance().disconnect();
      }
    } catch (e) {
      console.warn("[AuthClient] Storage write warning:", e);
    }
  }

  private notifyListeners(event: string, session: Session | null) {
    this.listeners.forEach((callback) => {
      try {
        callback(event, session);
      } catch (err) {
        console.error("[AuthClient] Error in auth listener:", err);
      }
    });
  }

  async getSession(): Promise<{ data: { session: Session | null }; error: null }> {
    const session = this.loadSessionFromStorage();
    return { data: { session }, error: null };
  }

  async getUser(): Promise<{ data: { user: UserProfile | null }; error: null }> {
    const { data } = await this.getSession();
    return { data: { user: data.session?.user || null }, error: null };
  }

  onAuthStateChange(callback: AuthChangeCallback): {
    data: { subscription: { unsubscribe: () => void } };
  } {
    this.listeners.add(callback);

    // Kirim initial state ke listener
    const session = this.loadSessionFromStorage();
    setTimeout(() => {
      callback(session ? "INITIAL_SESSION" : "SIGNED_OUT", session);
    }, 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(callback);
          },
        },
      },
    };
  }

  async signInWithPassword({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ data: { user: UserProfile | null; session: Session | null }; error: any }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          data: { user: null, session: null },
          error: { message: json.error || "Gagal masuk", status: res.status },
        };
      }

      const userProfile: UserProfile = {
        id: json.data.user.id,
        email: json.data.user.email,
        full_name: json.data.user.full_name,
        username: json.data.user.username,
        role: json.data.user.role,
        status: json.data.user.status,
        avatar_url: json.data.user.avatar_url,
        user_metadata: {
          full_name: json.data.user.full_name,
          name: json.data.user.full_name,
          avatar_url: json.data.user.avatar_url,
          role: json.data.user.role,
        },
        app_metadata: {
          role: json.data.user.role,
          provider: "native",
        },
      };

      const session: Session = {
        access_token: json.data.access_token,
        refresh_token: json.data.refresh_token,
        user: userProfile,
      };

      this.saveSession(session);
      this.notifyListeners("SIGNED_IN", session);

      return { data: { user: userProfile, session }, error: null };
    } catch (err: any) {
      return {
        data: { user: null, session: null },
        error: { message: err?.message || "Kesalahan koneksi ke server", status: 500 },
      };
    }
  }

  async signUp({
    email,
    password,
    options,
  }: {
    email: string;
    password: string;
    options?: { data?: Record<string, any> };
  }): Promise<{ data: { user: UserProfile | null; session: Session | null }; error: any }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: options?.data?.full_name,
          username: options?.data?.username,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          data: { user: null, session: null },
          error: { message: json.error || "Gagal mendaftar", status: res.status },
        };
      }

      const userProfile: UserProfile = {
        id: json.data.user.id,
        email: json.data.user.email,
        full_name: json.data.user.full_name,
        username: json.data.user.username,
        role: json.data.user.role,
        status: json.data.user.status,
        user_metadata: {
          full_name: json.data.user.full_name,
          name: json.data.user.full_name,
          role: json.data.user.role,
        },
        app_metadata: {
          role: json.data.user.role,
          provider: "native",
        },
      };

      const session: Session = {
        access_token: json.data.access_token,
        refresh_token: json.data.refresh_token,
        user: userProfile,
      };

      this.saveSession(session);
      this.notifyListeners("SIGNED_IN", session);

      return { data: { user: userProfile, session }, error: null };
    } catch (err: any) {
      return {
        data: { user: null, session: null },
        error: { message: err?.message || "Kesalahan server", status: 500 },
      };
    }
  }

  /**
   * signInWithIdToken
   * Memverifikasi Google ID Token ke backend Go dan menerbitkan JWT native
   */
  async signInWithIdToken({
    provider,
    token,
  }: {
    provider: string;
    token: string;
  }): Promise<{ data: { user: UserProfile | null; session: Session | null }; error: any }> {
    try {
      if (provider !== "google") {
        return {
          data: { user: null, session: null },
          error: { message: `Provider ${provider} belum didukung.` },
        };
      }

      if (!token) {
        return {
          data: { user: null, session: null },
          error: { message: "Token Google wajib disertakan." },
        };
      }

      const res = await fetch(`${getApiBaseUrl()}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: token }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          data: { user: null, session: null },
          error: {
            message: json.error || "Gagal masuk menggunakan Google.",
            status: res.status,
          },
        };
      }

      const tokenData = json.data;
      const rawUser = tokenData.user || {};

      const userProfile: UserProfile = {
        id: rawUser.id,
        email: rawUser.email,
        full_name: rawUser.full_name || rawUser.name,
        username: rawUser.username,
        role: rawUser.role || "customer",
        status: rawUser.status || "active",
        avatar_url: rawUser.avatar_url,
        user_metadata: {
          full_name: rawUser.full_name || rawUser.name,
          name: rawUser.full_name || rawUser.name,
          avatar_url: rawUser.avatar_url,
          role: rawUser.role || "customer",
        },
        app_metadata: {
          role: rawUser.role || "customer",
          provider: "google",
        },
      };

      const session: Session = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user: userProfile,
      };

      this.saveSession(session);
      this.notifyListeners("SIGNED_IN", session);

      return { data: { user: userProfile, session }, error: null };
    } catch (err: any) {
      return {
        data: { user: null, session: null },
        error: {
          message: err?.message || "Terjadi kesalahan saat masuk menggunakan Google.",
          status: 500,
        },
      };
    }
  }

  async signInWithOAuth({ provider }: { provider: string }): Promise<{ data: any; error: any }> {
    return { data: null, error: null };
  }

  async signOut(): Promise<{ error: null }> {
    const session = this.currentSession;
    if (session?.refresh_token) {
      try {
        fetch(`${getApiBaseUrl()}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        }).catch(() => { });
      } catch (e) { }
    }

    this.saveSession(null);
    this.notifyListeners("SIGNED_OUT", null);
    return { error: null };
  }

  async resetPasswordForEmail(email: string): Promise<{ error: null }> {
    return { error: null };
  }

  async updateUser(attributes: {
    data?: Record<string, any>;
    password?: string;
  }): Promise<{ data: { user: UserProfile | null }; error: any }> {
    try {
      const session = this.currentSession;
      if (!session) {
        return {
          data: { user: null },
          error: { message: "Belum masuk akun", status: 401 },
        };
      }
      const updatedUser: UserProfile = {
        ...session.user,
        user_metadata: {
          ...session.user.user_metadata,
          ...attributes.data,
        },
      };
      if (attributes.data?.name) {
        updatedUser.full_name = attributes.data.name;
      }
      if (attributes.data?.role) {
        updatedUser.role = attributes.data.role;
      }
      const updatedSession: Session = {
        ...session,
        user: updatedUser,
      };
      this.saveSession(updatedSession);
      this.notifyListeners("USER_UPDATED", updatedSession);
      return { data: { user: updatedUser }, error: null };
    } catch (err: any) {
      return {
        data: { user: null },
        error: { message: err?.message || "Gagal memperbarui profil", status: 500 },
      };
    }
  }

  async signInWithOtp(params: {
    email: string;
    options?: any;
  }): Promise<{ data: any; error: any }> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: params.email }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        return {
          data: null,
          error: {
            message: data.error || "Gagal mengirim OTP ke email",
            status: res.status,
          },
        };
      }
      return { data: { email: params.email }, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || "Gagal terhubung ke server", status: 500 },
      };
    }
  }

  async verifyOtp(params: {
    email: string;
    token: string;
    type?: string;
  }): Promise<{ data: { user: any; session: any }; error: any }> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: params.email, otp: params.token }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        return {
          data: { user: null, session: null },
          error: {
            message: data.error || "Kode OTP salah atau telah kedaluwarsa",
            status: res.status,
          },
        };
      }

      const tokenData = data.data;
      const session = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        user: tokenData.user,
      };

      this.saveSession(session);
      this.notifyListeners("SIGNED_IN", session);

      return {
        data: { user: tokenData.user, session },
        error: null,
      };
    } catch (err: any) {
      return {
        data: { user: null, session: null },
        error: { message: err?.message || "Gagal memverifikasi OTP", status: 500 },
      };
    }
  }

  async exchangeCodeForSession(code: string): Promise<{ data: { session: any }; error: any }> {
    const session = this.currentSession;
    return { data: { session }, error: null };
  }
}

// ==========================================
// SHARED REALTIME WEBSOCKET CONNECTION
// ==========================================

class SharedRealtimeSocket {
  private static instance: SharedRealtimeSocket | null = null;
  private ws: WebSocket | null = null;
  private channels: Set<NativeRealtimeChannel> = new Set();
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private isConnecting = false;

  public static getInstance(): SharedRealtimeSocket {
    if (!SharedRealtimeSocket.instance) {
      SharedRealtimeSocket.instance = new SharedRealtimeSocket();
    }
    return SharedRealtimeSocket.instance;
  }

  public register(ch: NativeRealtimeChannel) {
    this.channels.add(ch);
    this.ensureConnected();
  }

  public unregister(ch: NativeRealtimeChannel) {
    this.channels.delete(ch);
    if (this.channels.size === 0) {
      this.disconnect();
    }
  }

  public send(data: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(data);
      } catch (err) {
        console.warn("[SharedWS] Send error:", err);
      }
    }
  }

  public reconnectWithToken(token?: string) {
    this.disconnect();
    this.ensureConnected(token);
  }

  public disconnect() {
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) { }
      this.ws = null;
    }
    this.isConnecting = false;
  }

  private ensureConnected(providedToken?: string) {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isConnecting) return;

    const token =
      providedToken ||
      localStorage.getItem("mameko_access_token") ||
      localStorage.getItem("sb-access-token") ||
      "";

    // Jangan coba buka koneksi jika token belum tersedia (cegah HTTP 401 loop)
    if (!token) {
      return;
    }

    this.isConnecting = true;
    try {
      const baseUrl = getApiBaseUrl();
      const wsProto = baseUrl.startsWith("https") ? "wss:" : "ws:";
      const host = baseUrl.replace(/^https?:\/\//, "");
      const wsUrl = `${wsProto}//${host}/ws/chats?token=${encodeURIComponent(token)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send("ping");
            } catch (e) { }
          }
        }, 30000);

        try {
          this.ws?.send("ping");
        } catch (e) { }

        this.channels.forEach((ch) => ch.notifySubscribed());
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.channels.forEach((ch) => ch.dispatchMessage(parsed));
        } catch (e) {
          // ignore non-json messages like pong
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        clearInterval(this.pingTimer);
        if (this.channels.size > 0) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.ensureConnected(), 3000);
        }
      };

      this.ws.onerror = (err) => {
        this.isConnecting = false;
        console.warn("[SharedWS] Connection warning:", err);
      };
    } catch (err) {
      this.isConnecting = false;
      console.warn("[SharedWS] Connect exception:", err);
    }
  }
}

// ==========================================
// REALTIME CHANNEL (Native Realtime WebSocket)
// ==========================================

export class NativeRealtimeChannel {
  public topic: string;
  private listeners: Array<{
    type: string;
    filter: Record<string, any>;
    callback: (payload: any) => void;
  }> = [];
  private presencePayload: any = {};
  private isSubscribed = false;
  private statusCallback?: (status: string) => void;

  constructor(topic: string) {
    this.topic = topic;
  }

  on(
    type: string,
    filterOrCallback: any,
    optionalCallback?: (payload: any) => void
  ): NativeRealtimeChannel {
    let filter: Record<string, any> = {};
    let callback: (payload: any) => void = () => { };

    if (typeof filterOrCallback === "function") {
      callback = filterOrCallback as (payload: any) => void;
    } else {
      filter = (filterOrCallback as Record<string, any>) || {};
      callback = optionalCallback || (() => { });
    }

    this.listeners.push({ type, filter, callback });
    return this;
  }

  subscribe(statusCallback?: (status: string) => void): NativeRealtimeChannel {
    this.isSubscribed = true;
    this.statusCallback = statusCallback;
    SharedRealtimeSocket.getInstance().register(this);
    if (statusCallback) {
      setTimeout(() => statusCallback("SUBSCRIBED"), 50);
    }
    return this;
  }

  public notifySubscribed() {
    if (this.statusCallback) {
      this.statusCallback("SUBSCRIBED");
    }
  }

  public dispatchMessage(parsed: any) {
    if (!this.isSubscribed) return;

    if (parsed.event === "new_message") {
      const payload = {
        eventType: "INSERT",
        new: parsed.data,
        old: null,
        schema: "public",
        table: "chats",
      };

      this.listeners.forEach((l) => {
        if (l.type === "postgres_changes" || l.type === "*") {
          // If a table filter is defined and is NOT 'chats', do not dispatch chat messages to it
          if (l.filter?.table && l.filter.table !== "chats") {
            return;
          }
          l.callback(payload);
        }
      });
    } else if (parsed.event === "messages_read") {
      const payload = {
        eventType: "UPDATE",
        new: parsed.data,
        old: null,
        schema: "public",
        table: "chats",
      };

      this.listeners.forEach((l) => {
        if (l.type === "postgres_changes" || l.type === "*") {
          // If a table filter is defined and is NOT 'chats', do not dispatch chat updates to it
          if (l.filter?.table && l.filter.table !== "chats") {
            return;
          }
          l.callback(payload);
        }
      });
    }
  }

  async track(payload: any): Promise<"ok"> {
    this.presencePayload = payload;
    return "ok";
  }

  presenceState(): Record<string, any[]> {
    return {
      [this.topic]: [this.presencePayload],
    };
  }

  send(data: { type: string; event: string; payload: any }): Promise<"ok"> {
    if (data?.type === "broadcast") {
      SharedRealtimeSocket.getInstance().send(
        JSON.stringify({ event: data.event, data: data.payload })
      );
    }
    return Promise.resolve("ok");
  }

  unsubscribe() {
    this.isSubscribed = false;
    SharedRealtimeSocket.getInstance().unregister(this);
  }
}

// ==========================================
// DATABASE TABLE PROXY (Minimal Fallback)
// ==========================================

export class TableQueryBuilder {
  private tableName: string;
  private isSingleResult: boolean = false;
  private opType: "select" | "update" | "insert" | "delete" = "select";

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = "*") {
    this.opType = "select";
    return this;
  }

  eq(column: string, value: any) {
    return this;
  }

  neq(column: string, value: any) {
    return this;
  }

  not(column: string, operator: string, value: any) {
    return this;
  }

  in(column: string, values: any[]) {
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    return this;
  }

  limit(count: number) {
    return this;
  }

  single() {
    this.isSingleResult = true;
    return this;
  }

  maybeSingle() {
    this.isSingleResult = true;
    return this;
  }

  update(values: any) {
    this.opType = "update";
    return this;
  }

  insert(values: any) {
    this.opType = "insert";
    return this;
  }

  delete() {
    this.opType = "delete";
    return this;
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      if (this.opType === "select") {
        if (this.tableName === "profiles" && this.isSingleResult) {
          const { data } = await mamekoClient.auth.getSession();
          return { data: data?.session?.user || null, error: null };
        }
        if (this.tableName === "products") {
          const res = await fetch(`${getApiBaseUrl()}/api/products`);
          if (res.ok) {
            const json = await res.json();
            const list = Array.isArray(json?.products)
              ? json.products
              : Array.isArray(json?.data)
              ? json.data
              : [];
            return { data: this.isSingleResult ? list[0] || null : list, error: null };
          }
        }
      }
      return { data: this.isSingleResult ? null : [], error: null };
    } catch {
      return { data: this.isSingleResult ? null : [], error: null };
    }
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ==========================================
// MAMEKO CLIENT FACADE
// ==========================================

export class MamekoClientFacade {
  public auth: NativeAuthClient;
  private activeChannels: Map<string, NativeRealtimeChannel> = new Map();

  constructor() {
    this.auth = new NativeAuthClient();
  }

  channel(topic: string, _options?: any): NativeRealtimeChannel {
    if (this.activeChannels.has(topic)) {
      return this.activeChannels.get(topic)!;
    }
    const ch = new NativeRealtimeChannel(topic);
    this.activeChannels.set(topic, ch);
    return ch;
  }

  getChannels(): NativeRealtimeChannel[] {
    return Array.from(this.activeChannels.values());
  }

  removeChannel(ch: NativeRealtimeChannel) {
    ch.unsubscribe();
    this.activeChannels.delete(ch.topic);
  }

  from(tableName: string): TableQueryBuilder {
    return new TableQueryBuilder(tableName);
  }

  async rpc(fnName: string, params?: Record<string, any>): Promise<{ data: any; error: any }> {
    return { data: true, error: null };
  }
}

// Global Singleton Exports
export const mamekoClient = new MamekoClientFacade();
export const mameko = mamekoClient;
export const auth = mamekoClient.auth;
export const db = mamekoClient;

export default mamekoClient;

