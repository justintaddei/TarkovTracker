import admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  HttpsError,
  CallableRequest,
  Request as FirebaseRequest,
} from 'firebase-functions/v2/https';
import { request, gql } from 'graphql-request';
import UIDGenerator from 'uid-generator';
import {
  DocumentReference,
  DocumentSnapshot,
  WriteBatch,
  Transaction,
  Firestore,
  FieldValue,
} from 'firebase-admin/firestore';
import cors from 'cors';
import * as functions from 'firebase-functions';
import express, { Express, Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';

// Import new middleware and handlers
import { verifyBearer } from './middleware/auth.js';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
import progressHandler from './handlers/progressHandler.js';
import teamHandler from './handlers/teamHandler.js';
import tokenHandler from './handlers/tokenHandler.js';

// Import legacy functions for backward compatibility
import { createToken } from './token/create.js';
import { revokeToken } from './token/revoke.js';

import { getDeploymentConfig } from './deploy-config.js';
admin.initializeApp();
export { createToken, revokeToken };
// Interfaces used by the application (commented to avoid unused warnings)
// interface ApiToken {
//   owner: string;
//   note: string;
//   permissions: string[];
//   calls?: number;
//   createdAt?: admin.firestore.Timestamp;
//   token?: string;
// }

// interface UserContext {
//   id: string;
//   username?: string;
//   roles?: string[];
// }
// Get deployment configuration
const config = getDeploymentConfig();

const app: Express = express();

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  };
  
  if (config.enableDetailedLogging) {
    logger.log(`API Request: ${req.method} ${req.originalUrl}`, logData);
  } else {
    logger.log(`API Request: ${req.method} ${req.originalUrl}`);
  }
  next();
});

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Parse request bodies
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Apply new authentication middleware to API routes
app.use('/api', verifyBearer);

// ===== NEW API ROUTES (IMPROVED) =====
app.get('/api/token', tokenHandler.getTokenInfo);
app.get('/api/progress', progressHandler.getPlayerProgress);
app.get('/api/team/progress', teamHandler.getTeamProgress);
// Progress routes
app.post('/api/progress/level/:levelValue', progressHandler.setPlayerLevel);
app.post('/api/progress/task/:taskId', progressHandler.updateSingleTask);
app.post('/api/progress/tasks', progressHandler.updateMultipleTasks);
app.post('/api/progress/task/objective/:objectiveId', progressHandler.updateTaskObjective);

// Team routes with CORS options
app.options('/api/team/create', (req: Request, res: Response) => {
  res.status(200).send();
});
app.post('/api/team/create', teamHandler.createTeam);

app.options('/api/team/join', (req: Request, res: Response) => {
  res.status(200).send();
});
app.post('/api/team/join', teamHandler.joinTeam);

app.options('/api/team/leave', (req: Request, res: Response) => {
  res.status(200).send();
});
app.post('/api/team/leave', teamHandler.leaveTeam);
// ===== BACKWARD COMPATIBILITY ROUTES (v2) =====
// These ensure old /api/v2/ endpoints still work
app.get('/api/v2/token', tokenHandler.getTokenInfo);
app.get('/api/v2/progress', progressHandler.getPlayerProgress);
app.get('/api/v2/team/progress', teamHandler.getTeamProgress);
app.post('/api/v2/progress/level/:levelValue', progressHandler.setPlayerLevel);
app.post('/api/v2/progress/task/:taskId', progressHandler.updateSingleTask);
app.post('/api/v2/progress/tasks', progressHandler.updateMultipleTasks);
app.post('/api/v2/progress/task/objective/:objectiveId', progressHandler.updateTaskObjective);

// ===== HEALTH CHECK ROUTE =====
app.get('/health', asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      service: 'tarkovtracker-api',
      features: {
        newErrorHandling: config.useNewErrorHandling,
        newProgressService: config.useNewProgressService,
        newTeamService: config.useNewTeamService,
        newTokenService: config.useNewTokenService,
      },
    },
  });
}));

// ===== ERROR HANDLING =====
// Handle 404 for unmatched routes
app.use(notFoundHandler);

// Centralized error handler (must be last)
app.use(errorHandler);

export const api = functions.https.onRequest(app);
interface SystemDocData {
  team?: string | null;
  teamMax?: number;
  lastLeftTeam?: admin.firestore.Timestamp;
}
interface TeamDocData {
  owner?: string;
  password?: string;
  maximumMembers?: number;
  members?: string[];
  createdAt?: admin.firestore.Timestamp;
}

// Utility functions for common team operations
function validateAuth(request: CallableRequest<unknown>): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  return request.auth.uid;
}

function handleTeamError(
  operation: string,
  error: unknown,
  context: Record<string, unknown>
): never {
  logger.error(`Failed to ${operation}:`, { ...context, error });
  if (error instanceof HttpsError) {
    throw error;
  }
  const message = error instanceof Error ? error.message : String(error);
  throw new HttpsError('internal', `Error during ${operation}`, message);
}

async function generateSecurePassword(): Promise<string> {
  try {
    const passGen = new UIDGenerator(48, UIDGenerator.BASE62);
    const generated = await passGen.generate();
    if (generated && generated.length >= 4) {
      return generated;
    }
    logger.warn('Generated password was invalid, using fallback');
    return 'DEBUG_PASS_123';
  } catch (error) {
    logger.error('Error during password generation:', error);
    return 'ERROR_PASS_456';
  }
}
async function _leaveTeamLogic(request: CallableRequest<void>): Promise<{ left: boolean }> {
  const db: Firestore = admin.firestore();
  const userUid = validateAuth(request);
  try {
    let originalTeam: string | null = null;
    await db.runTransaction(async (transaction: Transaction) => {
      const systemRef: DocumentReference<SystemDocData> = db
        .collection('system')
        .doc(userUid) as DocumentReference<SystemDocData>;
      const systemDoc: DocumentSnapshot<SystemDocData> = await transaction.get(systemRef);
      const systemData = systemDoc?.data();
      originalTeam = systemData?.team ?? null;
      if (systemData?.team) {
        const teamRef: DocumentReference<TeamDocData> = db
          .collection('team')
          .doc(systemData.team) as DocumentReference<TeamDocData>;
        const teamDoc: DocumentSnapshot<TeamDocData> = await transaction.get(teamRef);
        const teamData = teamDoc?.data();
        if (teamData?.owner === userUid) {
          if (teamData?.members) {
            teamData.members.forEach((member: string) => {
              logger.log('Removing team from member', {
                member,
                team: originalTeam,
              });
              transaction.set(
                db.collection('system').doc(member),
                {
                  team: null,
                  lastLeftTeam: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            });
          }
          transaction.delete(teamRef);
        } else {
          transaction.set(teamRef, { members: FieldValue.arrayRemove(userUid) }, { merge: true });
          transaction.set(
            systemRef,
            {
              team: null,
              lastLeftTeam: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      } else {
        throw new HttpsError('failed-precondition', 'User is not in a team');
      }
      logger.log('Left team', {
        user: userUid,
        team: originalTeam,
      });
    });
    logger.log('Finished leave team', { user: userUid });
    return { left: true };
  } catch (e: unknown) {
    handleTeamError('leave team', e, { owner: userUid });
  }
}
interface JoinTeamData {
  id: string;
  password: string;
}
async function _joinTeamLogic(
  request: CallableRequest<JoinTeamData>
): Promise<{ joined: boolean }> {
  const db: Firestore = admin.firestore();
  const userUid = validateAuth(request);
  const data = request.data;
  try {
    await db.runTransaction(async (transaction: Transaction) => {
      const systemRef: DocumentReference<SystemDocData> = db
        .collection('system')
        .doc(userUid) as DocumentReference<SystemDocData>;
      const systemDoc: DocumentSnapshot<SystemDocData> = await transaction.get(systemRef);
      const systemData = systemDoc?.data();
      if (systemData?.team) {
        throw new HttpsError('failed-precondition', 'User is already in a team');
      }
      if (!data.id || !data.password) {
        throw new HttpsError('invalid-argument', 'Team ID and password required.');
      }
      const teamRef: DocumentReference<TeamDocData> = db
        .collection('team')
        .doc(data.id) as DocumentReference<TeamDocData>;
      const teamDoc: DocumentSnapshot<TeamDocData> = await transaction.get(teamRef);
      const teamData = teamDoc?.data();
      if (!teamDoc?.exists) {
        throw new HttpsError('not-found', "Team doesn't exist");
      }
      if (teamData?.password !== data.password) {
        throw new HttpsError('unauthenticated', 'Wrong password');
      }
      if ((teamData?.members?.length ?? 0) >= (teamData?.maximumMembers ?? 10)) {
        throw new HttpsError('resource-exhausted', 'Team is full');
      }
      transaction.set(teamRef, { members: FieldValue.arrayUnion(userUid) }, { merge: true });
      transaction.set(systemRef, { team: data.id }, { merge: true });
    });
    logger.log('Joined team', {
      user: userUid,
      team: data.id,
    });
    return { joined: true };
  } catch (e: unknown) {
    handleTeamError('join team', e, { user: userUid, team: data.id });
  }
}
interface CreateTeamData {
  password?: string;
  maximumMembers?: number;
}
async function _createTeamLogic(
  request: CallableRequest<CreateTeamData>
): Promise<{ team: string; password?: string }> {
  const db: Firestore = admin.firestore();
  const userUid = validateAuth(request);
  const data = request.data;
  try {
    let createdTeam = '';
    let finalTeamPassword = '';
    await db.runTransaction(async (transaction: Transaction) => {
      try {
        const systemRef: DocumentReference<SystemDocData> = db
          .collection('system')
          .doc(userUid) as DocumentReference<SystemDocData>;
        const systemDoc: DocumentSnapshot<SystemDocData> = await transaction.get(systemRef);
        const systemData = systemDoc?.data();

        if (systemData?.team) {
          throw new HttpsError('failed-precondition', 'User is already in a team.');
        }

        if (systemData?.lastLeftTeam) {
          const now = admin.firestore.Timestamp.now();
          const fiveMinutesAgo = admin.firestore.Timestamp.fromMillis(
            now.toMillis() - 5 * 60 * 1000
          );
          if (systemData.lastLeftTeam > fiveMinutesAgo) {
            throw new HttpsError(
              'failed-precondition',
              'You must wait 5 minutes after leaving a team to create a new one.'
            );
          }
        }

        const uidgen = new UIDGenerator(32);
        const teamId = await uidgen.generate();
        const teamPassword = data.password || (await generateSecurePassword());

        finalTeamPassword = teamPassword;
        createdTeam = teamId;
        const teamRef = db.collection('team').doc(teamId);

        transaction.set(teamRef, {
          owner: userUid,
          password: teamPassword,
          maximumMembers: data.maximumMembers || 10,
          members: [userUid],
          createdAt: FieldValue.serverTimestamp(),
        });

        transaction.set(systemRef, { team: teamId }, { merge: true });
      } catch (err) {
        logger.error('[createTeam] Error inside transaction:', err);
        throw err;
      }
    });
    logger.log('Created team', {
      owner: userUid,
      team: createdTeam,
      maximumMembers: data.maximumMembers || 10,
    });
    return { team: createdTeam, password: finalTeamPassword };
  } catch (e: unknown) {
    handleTeamError('create team', e, { owner: userUid });
  }
}
interface KickTeamMemberData {
  kicked: string;
}
async function _kickTeamMemberLogic(
  request: CallableRequest<KickTeamMemberData>
): Promise<{ kicked: boolean }> {
  const db: Firestore = admin.firestore();
  const userUid = validateAuth(request);
  const data = request.data;

  if (!data.kicked) {
    throw new HttpsError('invalid-argument', 'Kicked user ID required.');
  }
  if (data.kicked === userUid) {
    throw new HttpsError('invalid-argument', "You can't kick yourself.");
  }

  try {
    await db.runTransaction(async (transaction: Transaction) => {
      const systemRef: DocumentReference<SystemDocData> = db
        .collection('system')
        .doc(userUid) as DocumentReference<SystemDocData>;
      const systemDoc: DocumentSnapshot<SystemDocData> = await transaction.get(systemRef);
      const systemData = systemDoc?.data();
      const teamId = systemData?.team;
      if (!teamId) {
        throw new HttpsError('failed-precondition', 'User is not in a team.');
      }
      const teamRef: DocumentReference<TeamDocData> = db
        .collection('team')
        .doc(teamId) as DocumentReference<TeamDocData>;
      const teamDoc: DocumentSnapshot<TeamDocData> = await transaction.get(teamRef);
      const teamData = teamDoc?.data();
      if (teamData?.owner !== userUid) {
        throw new HttpsError('permission-denied', 'Only the team owner can kick members.');
      }
      if (!teamData?.members?.includes(data.kicked)) {
        throw new HttpsError('not-found', 'User not found in team.');
      }
      transaction.set(teamRef, { members: FieldValue.arrayRemove(data.kicked) }, { merge: true });
      const kickedUserSystemRef: DocumentReference<SystemDocData> = db
        .collection('system')
        .doc(data.kicked) as DocumentReference<SystemDocData>;
      transaction.set(
        kickedUserSystemRef,
        {
          team: null,
          lastLeftTeam: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    logger.log('Kicked member', {
      owner: userUid,
      kicked: data.kicked,
    });
    return { kicked: true };
  } catch (e: unknown) {
    handleTeamError('kick team member', e, { owner: userUid, kicked: data.kicked });
  }
}
export const createTeam = functions.https.onCall(_createTeamLogic);

// Alternative HTTPS endpoint for createTeam with explicit CORS handling
export const createTeamHttp = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Extract auth token from Authorization header
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    if (!authToken) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(authToken);

    // Create a mock callable request
    const callableRequest: CallableRequest<CreateTeamData> = {
      auth: {
        uid: decodedToken.uid,
        token: decodedToken,
      },
      data: req.body,
      rawRequest: req as unknown as FirebaseRequest,
      acceptsStreaming: false,
    };

    // Call the existing logic
    const result = await _createTeamLogic(callableRequest);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in createTeamHttp:', error);
    if (error instanceof HttpsError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
export const joinTeam = functions.https.onCall(_joinTeamLogic);
export const leaveTeam = functions.https.onCall(_leaveTeamLogic);
export const kickTeamMember = functions.https.onCall(_kickTeamMemberLogic);
interface TarkovItem {
  id: string;
  name?: string;
  shortName?: string;
  basePrice?: number;
  updated?: string;
  width?: number;
  height?: number;
  iconLink?: string;
  wikiLink?: string;
  imageLink?: string;
  types?: string[];
  avg24hPrice?: number;
  traderPrices?: {
    price?: number;
    trader?: {
      name?: string;
    };
  }[];
  buyFor?: {
    price?: number;
    currency?: string;
    requirements?: {
      type?: string;
      value?: string | number;
    }[];
    source?: string;
  }[];
  sellFor?: {
    price?: number;
    currency?: string;
    requirements?: {
      type?: string;
      value?: string | number;
    }[];
    source?: string;
  }[];
  [key: string]: unknown;
}
interface TarkovDataResponse {
  items: TarkovItem[];
}
async function retrieveTarkovdata(): Promise<TarkovDataResponse | undefined> {
  const query = gql`
    {
      items {
        id
        name
        shortName
        basePrice
        updated
        width
        height
        iconLink
        wikiLink
        imageLink
        types
        avg24hPrice
        traderPrices {
          price
          trader {
            name
          }
        }
        buyFor {
          price
          currency
          requirements {
            type
            value
          }
          source
        }
        sellFor {
          price
          currency
          requirements {
            type
            value
          }
          source
        }
      }
    }
  `;
  try {
    const data: TarkovDataResponse = await request('https://api.tarkov.dev/graphql', query);
    return data;
  } catch (e: unknown) {
    logger.error(
      'Failed to retrieve data from Tarkov API:',
      e instanceof Error ? e.message : String(e)
    );
    return undefined;
  }
}
async function saveTarkovData(data: TarkovDataResponse | undefined) {
  if (!data || !data.items) {
    logger.error('No data received from Tarkov API to save.');
    return;
  }
  const db: Firestore = admin.firestore();
  const batch: WriteBatch = db.batch();
  const itemsCollection = db.collection('items');
  data.items.forEach((item: TarkovItem) => {
    const docId = item.id.replace(/[/\\*?[\]]/g, '_');
    const docRef = itemsCollection.doc(docId);
    batch.set(docRef, item);
  });
  try {
    await batch.commit();
    logger.log(`Successfully saved ${data.items.length} items to Firestore.`);
  } catch (e: unknown) {
    logger.error(
      'Failed to save Tarkov data to Firestore:',
      e instanceof Error ? e.message : String(e)
    );
  }
}
export const scheduledTarkovDataFetch = onSchedule('every day 00:00', async () => {
  logger.log('Running scheduled Tarkov data fetch...');
  const data = await retrieveTarkovdata();
  await saveTarkovData(data);
});
