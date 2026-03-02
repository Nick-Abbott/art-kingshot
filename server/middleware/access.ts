module.exports = function createAccessMiddleware({
  requireAuth,
  requireAlliance,
  requireRole,
}) {
  function requireAuthMiddleware(req, res, next) {
    if (!requireAuth(req, res)) return;
    next();
  }

  function requireAllianceMiddleware(req, res, next) {
    if (!requireAlliance(req, res)) return;
    next();
  }

  function requireRoleMiddleware(roles = []) {
    return (req, res, next) => {
      if (!requireRole(req, res, roles)) return;
      next();
    };
  }

  return {
    requireAuthMiddleware,
    requireAllianceMiddleware,
    requireRoleMiddleware,
  };
};

export {};
