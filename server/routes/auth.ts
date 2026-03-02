const express = require("express");

module.exports = function authRoutes(ctx) {
  const router = express.Router();

  router.get("/api/auth/discord", (req, res) => {
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

  router.get("/api/auth/discord/callback", async (req, res) => {
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

      let user = ctx.selectUserByDiscordId.get(discordId);
      if (!user) {
        const now = Date.now();
        const id = ctx.crypto.randomUUID();
        let isAppAdmin = 0;

        ctx.db.transaction(() => {
          const bootstrap = ctx.insertBootstrapRow.run(now);
          if (bootstrap.changes === 1) {
            isAppAdmin = 1;
          }
          ctx.insertUser.run(id, discordId, displayName, avatar, isAppAdmin, now);
        })();

        user = ctx.selectUserById.get(id);
      } else {
        ctx.updateUser.run(displayName, avatar, user.id);
      }

      ctx.ensureMemberships(user.id, Boolean(user.isAppAdmin));
      const sessionToken = ctx.createSession(user.id);
      ctx.setCookie(res, "ak_session", sessionToken, {
        path: "/",
        httpOnly: true,
        secure: ctx.isProduction,
        sameSite: "Lax",
        maxAge: Math.floor(ctx.SESSION_TTL_MS / 1000),
      });
      res.redirect(ctx.APP_BASE_URL);
    } catch (error) {
      ctx.fail(res, 500, "Discord authentication failed.");
    }
  });

  router.post("/api/auth/logout", (req, res) => {
    if (req.sessionToken) {
      ctx.deleteSession.run(req.sessionToken);
    }
    ctx.clearCookie(res, "ak_session");
    ctx.ok(res, { ok: true });
  });

  router.get("/api/me", ctx.requireAuthMiddleware, (req, res) => {
    const memberships = req.memberships || [];
    ctx.ok(res, { user: req.user, memberships });
  });

  router.get("/api/alliances", ctx.requireAuthMiddleware, (req, res) => {
    ctx.ok(res, { memberships: req.memberships || [] });
  });

  return router;
};

export {};
