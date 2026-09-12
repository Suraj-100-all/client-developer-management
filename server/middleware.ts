import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from './auth.js';
import type { Role } from '../src/types.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

// Authentication Middleware: extracts & validates Bearer token
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Access denied: Authentication token required',
      statusCode: 401,
    });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'TOKEN_EXPIRED_OR_INVALID',
      message: 'Your session has expired or the token is invalid. Please refresh or sign in again.',
      statusCode: 401,
    });
    return;
  }

  req.user = payload;
  next();
};

// Strict Role-Based Authorization Middleware
export const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication is required to access this resource',
        statusCode: 401,
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Forbidden: Role '${req.user.role}' does not have permission to perform this action. Required: [${allowedRoles.join(', ')}]`,
        statusCode: 403,
      });
      return;
    }

    next();
  };
};

// Global structured error handling middleware
export const structuredErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[API Error]:', err?.message || err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected internal server error occurred';
  const error = err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR');

  res.status(statusCode).json({
    error,
    message,
    statusCode,
    ...(process.env.NODE_ENV !== 'production' && err.details ? { details: err.details } : {}),
  });
};
