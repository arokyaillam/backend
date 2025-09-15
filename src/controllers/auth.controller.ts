import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db'; // நமது DB மற்றும் ஸ்கீமா இறக்குமதி

/**
 * இது நமது அங்கீகார வழிகளுக்கான (Auth Routes) ஒரு தனி Elysia plugin (module).
 */
export const authController = new Elysia({ prefix: '/auth' })
    // அனைத்து /auth வழிகளிலும் நமது db மற்றும் schema கிடைப்பதை உறுதி செய்கிறோம்.
    // (இது ஏற்கனவே index.ts-ல் toàn cầu (globally) decorate செய்யப்பட்டிருந்தாலும், இங்கே செய்வது பாதுகாப்பானது)
    .decorate({ db }) 
    .decorate({ schema })

    /**
     * POST /auth/signup
     * நமது பிளாட்ஃபார்மில் ஒரு புதிய பயனரைப் பதிவு செய்ய
     */
    .post(
      '/signup',
      async ({ db, body, set }) => {
        try {
          // 1. பயனர் ஏற்கனவே இருக்கிறாரா என்று சரிபார்க்கவும்
          const existingUser = await db.query.platformUsers.findFirst({
            where: eq(schema.platformUsers.email, body.email.toLowerCase()),
          });

          if (existingUser) {
            set.status = 409; // Conflict
            return { error: 'இந்த மின்னஞ்சலில் பயனர் ஏற்கனவே உள்ளார்' };
          }

          // 2. Bun-ன் நேட்டிவ் Argon2 ஐப் பயன்படுத்தி கடவுச்சொல்லை Hash செய்யவும்
          const passwordHash = await Bun.password.hash(body.password, {
            algorithm: 'argon2id',
            memoryCost: 4, // 4 MiB
            timeCost: 3,   // 3 iterations
          });

          // 3. புதிய பயனரை Postgres DB-ல் சேமிக்கவும்
          const newUser = await db
            .insert(schema.platformUsers)
            .values({
              email: body.email.toLowerCase(),
              passwordHash: passwordHash,
            })
            .returning({
              userId: schema.platformUsers.userId,
              email: schema.platformUsers.email,
            });

          set.status = 201; // Created
          return newUser[0];

        } catch (e: any) {
          console.error('[Auth Signup Error]', e.message);
          set.status = 500;
          return { error: 'சேவையகத்தில் பிழை ஏற்பட்டது' };
        }
      },
      {
        // Elysia-வின் உள்ளமைந்த சரிபார்ப்பு (Validation)
        // நாம் drizzle-typebox-ஐ நிறுவியுள்ளோம், அதை ஸ்கீமா உருவாக்கப் பயன்படுத்தலாம்
        body: t.Object({
          email: t.String({ format: 'email', error: 'சரியான மின்னஞ்சல் தேவை' }),
          password: t.String({ minLength: 8, error: 'கடவுச்சொல் குறைந்தபட்சம் 8 எழுத்துகள் இருக்க வேண்டும்' }),
        }),
      }
    );

// ... (Login endpoint அடுத்த படியில் சேர்க்கப்படும்)