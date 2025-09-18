// src/controllers/broker.controller.ts
import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { jwt } from '@elysiajs/jwt';
import { db, schema } from '../db';

// Encryption utilities (simple example - use proper encryption in production)
const encrypt = (text: string): string => {
  // In production, use proper encryption like crypto.subtle or a library
  return Buffer.from(text).toString('base64');
};

const decrypt = (encryptedText: string): string => {
  // In production, use proper decryption
  return Buffer.from(encryptedText, 'base64').toString();
};

export const brokerController = new Elysia({ prefix: '/broker' })
  .decorate({ db })
  .decorate({ schema })

  // JWT middleware for protected routes
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET!,
      exp: '7d',
      schema: t.Object({
        userId: t.String(),
        email: t.String()
      })
    })
  )

  /**
   * POST /broker/upstox/credentials
   * Store Upstox API credentials for user
   */
  .post(
    '/upstox/credentials',
    async ({ db, jwt, headers, body, set }) => {
      try {
        // Verify JWT token
        const userPayload = await jwt.verify(headers.authorization?.split(' ')[1]);
        if (!userPayload) {
          set.status = 401;
          return { error: 'Unauthorized' };
        }

        // Check if user already has Upstox connection
        const existingConnection = await db.query.brokerConnections.findFirst({
          where: and(
            eq(schema.brokerConnections.userId, userPayload.userId),
            eq(schema.brokerConnections.brokerName, 'upstox')
          )
        });

        if (existingConnection) {
          // Update existing credentials
          await db
            .update(schema.brokerConnections)
            .set({
              upstoxApiKeyEncrypted: encrypt(body.apiKey),
              upstoxApiSecretEncrypted: encrypt(body.apiSecret),
              upstoxRedirectUri: body.redirectUri,
              isActive: true,
              // Clear old tokens when credentials updated
              accessTokenEncrypted: null,
              refreshTokenEncrypted: null,
              tokenValidUntil: null
            })
            .where(eq(schema.brokerConnections.connectionId, existingConnection.connectionId));

          return { message: 'Upstox credentials updated successfully' };
        } else {
          // Create new connection
          const newConnection = await db
            .insert(schema.brokerConnections)
            .values({
              userId: userPayload.userId,
              brokerName: 'upstox',
              upstoxApiKeyEncrypted: encrypt(body.apiKey),
              upstoxApiSecretEncrypted: encrypt(body.apiSecret),
              upstoxRedirectUri: body.redirectUri
            })
            .returning({ connectionId: schema.brokerConnections.connectionId });

          return { 
            message: 'Upstox credentials saved successfully',
            connectionId: newConnection[0].connectionId
          };
        }
      } catch (error) {
        console.error('Error saving Upstox credentials:', error);
        set.status = 500;
        return { error: 'Failed to save credentials' };
      }
    },
    {
      headers: t.Object({
        authorization: t.String({ startsWith: 'Bearer ' })
      }),
      body: t.Object({
        apiKey: t.String({ minLength: 1 }),
        apiSecret: t.String({ minLength: 1 }),
        redirectUri: t.String({ format: 'uri' })
      })
    }
  )

  /**
   * GET /broker/upstox/auth-url
   * Generate Upstox OAuth authorization URL
   */
  .get(
    '/upstox/auth-url',
    async ({ db, jwt, headers, query, set }) => {
      try {
        // Verify JWT token
        const userPayload = await jwt.verify(headers.authorization?.split(' ')[1]);
        if (!userPayload) {
          set.status = 401;
          return { error: 'Unauthorized' };
        }

        // Get user's Upstox connection
        const connection = await db.query.brokerConnections.findFirst({
          where: and(
            eq(schema.brokerConnections.userId, userPayload.userId),
            eq(schema.brokerConnections.brokerName, 'upstox')
          )
        });

        if (!connection) {
          set.status = 404;
          return { error: 'Upstox credentials not found. Please add credentials first.' };
        }

        // Decrypt API key
        const apiKey = decrypt(connection.upstoxApiKeyEncrypted);
        const redirectUri = connection.upstoxRedirectUri;
        
        // Generate state parameter (optional but recommended)
        const state = Buffer.from(`${userPayload.userId}:${Date.now()}`).toString('base64');

        // Construct Upstox OAuth URL
        const authUrl = new URL('https://api.upstox.com/v2/login/authorization/dialog');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', apiKey);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);

        return {
          authUrl: authUrl.toString(),
          state,
          expiresIn: 300 // URL valid for 5 minutes
        };

      } catch (error) {
        console.error('Error generating auth URL:', error);
        set.status = 500;
        return { error: 'Failed to generate authorization URL' };
      }
    },
    {
      headers: t.Object({
        authorization: t.String({ startsWith: 'Bearer ' })
      })
    }
  )

  /**
   * POST /broker/upstox/callback
   * Handle Upstox OAuth callback and exchange code for tokens
   */
  .post(
    '/upstox/callback',
    async ({ db, jwt, headers, body, set }) => {
      try {
        // Verify JWT token
        const userPayload = await jwt.verify(headers.authorization?.split(' ')[1]);
        if (!userPayload) {
          set.status = 401;
          return { error: 'Unauthorized' };
        }

        // Get user's Upstox connection
        const connection = await db.query.brokerConnections.findFirst({
          where: and(
            eq(schema.brokerConnections.userId, userPayload.userId),
            eq(schema.brokerConnections.brokerName, 'upstox')
          )
        });

        if (!connection) {
          set.status = 404;
          return { error: 'Upstox connection not found' };
        }

        // Decrypt credentials
        const apiKey = decrypt(connection.upstoxApiKeyEncrypted);
        const apiSecret = decrypt(connection.upstoxApiSecretEncrypted);

        // Exchange authorization code for access token
        const tokenResponse = await fetch('https://api.upstox.com/v2/login/authorization/token', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            code: body.code,
            client_id: apiKey,
            client_secret: apiSecret,
            redirect_uri: connection.upstoxRedirectUri,
            grant_type: 'authorization_code'
          })
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          console.error('Upstox token error:', errorData);
          set.status = 400;
          return { error: 'Failed to exchange authorization code for token' };
        }

        const tokenData = await tokenResponse.json();

        // Calculate token expiry (Upstox tokens valid until 3:30 AM next day)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(3, 30, 0, 0); // 3:30 AM next day

        // Update connection with tokens
        await db
          .update(schema.brokerConnections)
          .set({
            accessTokenEncrypted: encrypt(tokenData.access_token),
            refreshTokenEncrypted: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
            tokenValidUntil: tomorrow,
            isActive: true
          })
          .where(eq(schema.brokerConnections.connectionId, connection.connectionId));

        return {
          message: 'Upstox connection established successfully',
          tokenValidUntil: tomorrow.toISOString(),
          hasExtendedToken: !!tokenData.extended_token
        };

      } catch (error) {
        console.error('Error processing Upstox callback:', error);
        set.status = 500;
        return { error: 'Failed to process authorization callback' };
      }
    },
    {
      headers: t.Object({
        authorization: t.String({ startsWith: 'Bearer ' })
      }),
      body: t.Object({
        code: t.String({ minLength: 1 }),
        state: t.Optional(t.String())
      })
    }
  )

  /**
   * GET /broker/upstox/status
   * Get Upstox connection status for user
   */
  .get(
    '/upstox/status',
    async ({ db, jwt, headers, set }) => {
      try {
        // Verify JWT token
        const userPayload = await jwt.verify(headers.authorization?.split(' ')[1]);
        if (!userPayload) {
          set.status = 401;
          return { error: 'Unauthorized' };
        }

        // Get user's Upstox connection
        const connection = await db.query.brokerConnections.findFirst({
          where: and(
            eq(schema.brokerConnections.userId, userPayload.userId),
            eq(schema.brokerConnections.brokerName, 'upstox')
          )
        });

        if (!connection) {
          return {
            isConnected: false,
            hasCredentials: false,
            message: 'No Upstox connection found'
          };
        }

        const hasCredentials = !!(connection.upstoxApiKeyEncrypted && connection.upstoxApiSecretEncrypted);
        const hasValidToken = !!(connection.accessTokenEncrypted && connection.tokenValidUntil && new Date(connection.tokenValidUntil) > new Date());

        return {
          isConnected: hasValidToken,
          hasCredentials,
          isActive: connection.isActive,
          tokenValidUntil: connection.tokenValidUntil,
          connectionId: connection.connectionId,
          createdAt: connection.createdAt
        };

      } catch (error) {
        console.error('Error getting Upstox status:', error);
        set.status = 500;
        return { error: 'Failed to get connection status' };
      }
    },
    {
      headers: t.Object({
        authorization: t.String({ startsWith: 'Bearer ' })
      })
    }
  )

  /**
   * DELETE /broker/upstox/disconnect
   * Disconnect and remove Upstox connection
   */
  .delete(
    '/upstox/disconnect',
    async ({ db, jwt, headers, set }) => {
      try {
        // Verify JWT token
        const userPayload = await jwt.verify(headers.authorization?.split(' ')[1]);
        if (!userPayload) {
          set.status = 401;
          return { error: 'Unauthorized' };
        }

        // Delete user's Upstox connection
        const deletedConnections = await db
          .delete(schema.brokerConnections)
          .where(
            and(
              eq(schema.brokerConnections.userId, userPayload.userId),
              eq(schema.brokerConnections.brokerName, 'upstox')
            )
          )
          .returning({ connectionId: schema.brokerConnections.connectionId });

        if (deletedConnections.length === 0) {
          set.status = 404;
          return { error: 'No Upstox connection found to disconnect' };
        }

        return {
          message: 'Upstox connection disconnected successfully',
          disconnectedConnectionId: deletedConnections[0].connectionId
        };

      } catch (error) {
        console.error('Error disconnecting Upstox:', error);
        set.status = 500;
        return { error: 'Failed to disconnect Upstox connection' };
      }
    },
    {
      headers: t.Object({
        authorization: t.String({ startsWith: 'Bearer ' })
      })
    }
  );