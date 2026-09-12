import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  comparePasswords,
  sanitizeUser,
} from '../auth.js';
import { requireAuth, AuthenticatedRequest } from '../middleware.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Email and password are required',
      statusCode: 400,
    });
    return;
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
      statusCode: 401,
    });
    return;
  }

  const isValid = await comparePasswords(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
      statusCode: 401,
    });
    return;
  }

  const tokenPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  // Store refresh token in HttpOnly cookie as required
  setRefreshTokenCookie(res, refreshToken);

  res.json({
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  });
});

// POST /api/auth/refresh
router.post('/refresh', (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) {
    res.status(401).json({
      error: 'NO_REFRESH_TOKEN',
      message: 'No refresh token provided in request body or cookie',
      statusCode: 401,
    });
    return Promise.resolve();
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    clearRefreshTokenCookie(res);
    res.status(401).json({
      error: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token is expired or invalid. Please log in again.',
      statusCode: 401,
    });
    return Promise.resolve();
  }

  const user = db.users.get(payload.userId);
  if (!user) {
    clearRefreshTokenCookie(res);
    res.status(401).json({
      error: 'USER_NOT_FOUND',
      message: 'User associated with token no longer exists',
      statusCode: 401,
    });
    return Promise.resolve();
  }

  const newTokenPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const newAccessToken = signAccessToken(newTokenPayload);
  const newRefreshToken = signRefreshToken(newTokenPayload);
  setRefreshTokenCookie(res, newRefreshToken);

  res.json({
    user: sanitizeUser(user),
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
  return Promise.resolve();
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response): void => {
  clearRefreshTokenCookie(res);
  res.json({ success: true, message: 'Successfully logged out' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 });
    return;
  }

  const user = db.users.get(req.user.userId);
  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found', statusCode: 404 });
    return;
  }

  res.json({ user: sanitizeUser(user) });
});

// POST /api/auth/switch (Persona switcher for preview & testing environments)
router.post('/switch', (req: Request, res: Response): void => {
  const { userId } = req.body;
  const user = db.users.get(userId);

  if (!user) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'Target user for role switch not found',
      statusCode: 404,
    });
    return;
  }

  const tokenPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);
  setRefreshTokenCookie(res, refreshToken);

  res.json({
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  });
});

// GET /api/auth/users
router.get('/users', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const roleFilter = req.query.role as string | undefined;

  let users = Array.from(db.users.values()).map(sanitizeUser);
  if (roleFilter) {
    users = users.filter((u) => u.role === roleFilter);
  }

  res.json({ users });
});

export default router;
