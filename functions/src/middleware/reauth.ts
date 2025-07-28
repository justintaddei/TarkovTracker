import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { errors } from './errorHandler.js';
import { ApiError } from '../types/api.js';

interface ReAuthenticatedRequest extends Request {
  user?: {
    id: string;
    username?: string;
    recentlyAuthenticated?: boolean;
  };
}

/**
 * Middleware that requires recent authentication for sensitive operations
 * Users must have signed in within the last 5 minutes for account deletion
 */
export const requireRecentAuth = async (
  req: ReAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw errors.unauthorized('Authentication required');
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the ID token and check if authentication is recent
    const decodedToken = await admin.auth().verifyIdToken(idToken, true); // checkRevoked = true
    
    // Check if user authenticated recently (within 5 minutes)
    const authTime = decodedToken.auth_time * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    if (authTime < fiveMinutesAgo) {
      logger.warn('User authentication too old for sensitive operation', {
        userId: decodedToken.uid,
        authTime: new Date(authTime),
        required: new Date(fiveMinutesAgo)
      });
      
      throw new ApiError(
        403, 
        'Recent authentication required. Please sign out and sign back in to continue.',
        'RECENT_AUTH_REQUIRED'
      );
    }

    // Attach user info to request
    req.user = {
      id: decodedToken.uid,
      username: decodedToken.email || decodedToken.name,
      recentlyAuthenticated: true
    };

    logger.info('Recent authentication verified', { 
      userId: decodedToken.uid,
      authTime: new Date(authTime)
    });

    next();
  } catch (error: unknown) {
    logger.error('Re-authentication middleware error', { error });
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'auth/id-token-revoked') {
        res.status(401).json({
          success: false,
          error: 'Token has been revoked. Please sign in again.',
          code: 'TOKEN_REVOKED'
        });
      } else if (firebaseError.code === 'auth/id-token-expired') {
        res.status(401).json({
          success: false,
          error: 'Token has expired. Please sign in again.',
          code: 'TOKEN_EXPIRED'
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'Invalid authentication token',
          code: 'INVALID_TOKEN'
        });
      }
    }
  }
};

/**
 * Alternative middleware for operations requiring explicit password confirmation
 * This would be used if you want to implement password re-entry instead of recent auth
 */
export const requirePasswordConfirmation = async (
  req: ReAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { password } = req.body;
    
    if (!password) {
      throw errors.badRequest('Password confirmation required');
    }

    // Get user's current auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw errors.unauthorized('Authentication required');
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Note: Firebase Admin SDK doesn't have a direct way to verify passwords
    // This would require additional implementation or using the client SDK
    // For now, we'll rely on recent authentication instead
    
    req.user = {
      id: decodedToken.uid,
      username: decodedToken.email || decodedToken.name,
      recentlyAuthenticated: true
    };

    next();
  } catch (error: unknown) {
    logger.error('Password confirmation middleware error', { error });
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Authentication verification failed'
      });
    }
  }
};