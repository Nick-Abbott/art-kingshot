import express from "express";
import type { Request, Response } from "express";
import type { RouteContext } from "../types";

export default function authRoutes(ctx: RouteContext) {
  const router = express.Router();

  router.get("/api/auth/discord", (req: Request, res: Response) => {
    if (
      !ctx.enforceRateLimit(req, res, {
        key: `oauth:${req.ip || "unknown"}`,
        max: 10,
        windowMs: 60_000,
      })
    ) {
      return;
    }
    if (!ctx.DISCORD_CLIENT_ID || !ctx.DISCORD_CLIENT_SECRET || !ctx.DISCORD_REDIRECT_URI) {
      ctx.fail(res, 500, "Discord auth is not configured.");
      return;
    }
    const state = ctx.crypto.randomBytes(16).toString("hex");
    ctx.setCookie(res, "oauth_state", state, {
      path: "/",
      httpOnly: true,
      secure: ctx.isProduction,
      sameSite: "Lax",
      maxAge: 600,
    });
    const params = new URLSearchParams({
      client_id: ctx.DISCORD_CLIENT_ID,
      redirect_uri: ctx.DISCORD_REDIRECT_URI,
      response_type: "code",
      scope: "identify",
      state,
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
  });

  router.get(
    "/api/auth/discord/callback",
    async (req: Request, res: Response) => {
      if (
      !ctx.enforceRateLimit(req, res, {
        key: `oauth-callback:${req.ip || "unknown"}`,
        max: 10,
        windowMs: 60_000,
      })
    ) {
      return;
      }
      if (!ctx.DISCORD_CLIENT_ID || !ctx.DISCORD_CLIENT_SECRET || !ctx.DISCORD_REDIRECT_URI) {
        ctx.fail(res, 500, "Discord auth is not configured.");
        return;
      }
      const code = typeof req.query?.code === "string" ? req.query.code.trim() : "";
      const state = typeof req.query?.state === "string" ? req.query.state.trim() : "";
      const cookies = ctx.parseCookies(req.headers.cookie || "");
      const storedState = cookies.oauth_state;
      ctx.clearCookie(res, "oauth_state");

      if (!code || !state || !storedState || storedState !== state) {
        ctx.fail(res, 400, "Invalid auth state.");
        return;
      }

      try {
        const tokenPayload = await ctx.exchangeDiscordToken(code);
        const discordUser = await ctx.fetchDiscordUser(tokenPayload.access_token);
        const discordId = discordUser.id;
        const displayName = ctx.getDiscordDisplayName(discordUser);
        const avatar = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null;

      let user = ctx.getUserByDiscordId(discordId);
      if (!user) {
        const now = Date.now();
        const id = ctx.crypto.randomUUID();
          let isAppAdmin = 0;

          ctx.db.transaction(() => {
          const bootstrap = ctx.insertBootstrapRow(now);
          if (bootstrap.changes === 1) {
            isAppAdmin = 1;
          }
          ctx.insertUser(id, discordId, displayName, avatar, isAppAdmin, now);
        })();

        user = ctx.getUserById(id);
      } else {
        ctx.updateUser(displayName, avatar, user.id);
      }

      if (!user) {
        ctx.fail(res, 500, "Failed to create user session.");
        return;
      }
      const sessionToken = ctx.createSession(user.id);
        ctx.setCookie(res, "ak_session", sessionToken, {
          path: "/",
          httpOnly: true,
          secure: ctx.isProduction,
          sameSite: "Lax",
          maxAge: Math.floor(ctx.SESSION_TTL_MS / 1000),
        });
        res.redirect(ctx.APP_BASE_URL);
      } catch {
        ctx.fail(res, 500, "Discord authentication failed.");
      }
    }
  );

  router.post("/api/auth/logout", (req: Request, res: Response) => {
    if (req.sessionToken) {
      ctx.deleteSession(req.sessionToken);
    }
    ctx.clearCookie(res, "ak_session");
    ctx.ok(res, { ok: true });
  });

  router.get("/api/me", ctx.requireAuthMiddleware, (req: Request, res: Response) => {
    const profiles = req.profiles || [];
    ctx.ok(res, { user: req.user, profiles });
  });

  router.get(
    "/api/alliances",
    ctx.requireAuthMiddleware,
    (req: Request, res: Response) => {
    ctx.ok(res, { profiles: req.profiles || [] });
  });

  return router;
};

export {};
