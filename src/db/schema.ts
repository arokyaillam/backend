import { pgTable, text, uuid, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Tier 1 Auth: நமது பிளாட்ஃபார்ம் பயனர்கள்
export const platformUsers = pgTable('platform_users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(), // Bun.password hash இங்கே சேமிக்கப்படும்
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tier 2 Auth: பயனர்களின் தரகர் இணைப்புகள்
export const brokerConnections = pgTable('broker_connections', {
  connectionId: uuid('connection_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => platformUsers.userId, { onDelete: 'cascade' }),
  brokerName: text('broker_name').default('upstox').notNull(),
  upstoxApiKeyEncrypted: text('upstox_api_key_encrypted').notNull(),
  upstoxApiSecretEncrypted: text('upstox_api_secret_encrypted').notNull(),
  upstoxRedirectUri: text('upstox_redirect_uri').notNull(),
  accessTokenEncrypted: text('access_token_encrypted'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenValidUntil: timestamp('token_valid_until', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// இரு டேபிள்களுக்கும் இடையிலான உறவுகள் (Relations)
export const platformUsersRelations = relations(platformUsers, ({ many }) => ({
  brokerConnections: many(brokerConnections),
}));

export const brokerConnectionsRelations = relations(brokerConnections, ({ one }) => ({
  user: one(platformUsers, {
    fields: [brokerConnections.userId],
    references: [platformUsers.userId],
  }),
}));

// நமது முழு ஸ்கீமாவையும் ஒன்றாக ஏற்றுமதி செய்ய (export)
export const schema = {
    platformUsers,
    brokerConnections,
    platformUsersRelations,
    brokerConnectionsRelations
};