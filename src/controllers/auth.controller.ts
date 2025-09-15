import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { jwt } from '@elysiajs/jwt'; // <-- படி 1: JWT பிளகினை இறக்குமதி செய்

export const authController = new Elysia({ prefix: '/auth' })
    .decorate({ db }) 
    .decorate({ schema })

    /**
     * படி 2: JWT பிளகினை நமது Auth Controller-ல் இணைக்கவும்.
     * இது .env கோப்பிலிருந்து நமது JWT_SECRET-ஐப் பயன்படுத்தும்.
     */
    .use(
      jwt({
        name: 'jwt', // context-ல் இதை 'jwt' என்று அழைப்போம்
        secret: process.env.JWT_SECRET!, // நமது ரகசியச் சொல்
        exp: '7d', // டோக்கன் 7 நாட்களுக்கு செல்லுபடியாகும்
        schema: t.Object({ // டோக்கனில் நாம் என்ன சேமிக்கப் போகிறோம்
          userId: t.String(),
          email: t.String()
        })
      })
    )

    /**
     * படி 8-லிருந்து நமது Signup Endpoint
     */
    .post(
      '/signup',
      async ({ db, body, set }) => {
        const existingUser = await db.query.platformUsers.findFirst({
            where: eq(schema.platformUsers.email, body.email.toLowerCase()),
        });

        if (existingUser) {
            set.status = 409; 
            return { error: 'இந்த மின்னஞ்சலில் பயனர் ஏற்கனவே உள்ளார்' };
        }

        const passwordHash = await Bun.password.hash(body.password, { algorithm: 'argon2id' });

        const newUser = await db
            .insert(schema.platformUsers)
            .values({
              email: body.email.toLowerCase(),
              passwordHash: passwordHash,
            })
            .returning({ userId: schema.platformUsers.userId, email: schema.platformUsers.email });

        set.status = 201;
        return newUser[0];
      },
      {
        body: t.Object({
          email: t.String({ format: 'email' }),
          password: t.String({ minLength: 8 }),
        }),
      }
    )

    /**
     * படி 3: புதிய Login Endpoint
     * POST /auth/login
     */
    .post(
        '/login',
        async ({ db, jwt, body, set }) => {
            // 1. பயனரை மின்னஞ்சல் மூலம் தேடவும்
            const user = await db.query.platformUsers.findFirst({
                where: eq(schema.platformUsers.email, body.email.toLowerCase())
            });

            if (!user) {
                set.status = 403; // Forbidden
                return { error: 'மின்னஞ்சல் அல்லது கடவுச்சொல் தவறானது' };
            }

            // 2. Bun-ன் நேட்டிவ் கருவி மூலம் கடவுச்சொல்லைச் சரிபார்க்கவும்
            const isMatch = await Bun.password.verify(body.password, user.passwordHash);

            if (!isMatch) {
                set.status = 403;
                return { error: 'மின்னஞ்சல் அல்லது கடவுச்சொல் தவறானது' };
            }

            // 3. வெற்றி! பயனருக்கான JWT டோக்கனை உருவாக்கவும்.
            const sessionToken = await jwt.sign({
                userId: user.userId,
                email: user.email
            });

            return { token: sessionToken };
        },
        {
            // Login-க்கான ஸ்கீமா சரிபார்ப்பு
            body: t.Object({
                email: t.String({ format: 'email' }),
                password: t.String()
            })
        }
        
    )
    /**
     * படி 11: பாதுகாக்கப்பட்ட '/me' Endpoint (JWT Guard உடன்)
     * இது பயனரின் டோக்கனைச் சரிபார்த்து, அவரின் சுயவிவரத் தகவலைத் திருப்பித் தரும்.
     */
    .get(
      '/me',
      async ({ jwt, headers, set }) => {
          // 1. டோக்கனைச் சரிபார்த்து, பயனர் Payload-ஐப் பெறவும் (verify மற்றும் decode)
          const userPayload = await jwt.verify(headers.authorization?.split(' ')[1]); // "Bearer TOKEN..."

          if (!userPayload) {
              set.status = 401; // Unauthorized
              return { error: 'அங்கீகரிக்கப்படாத கோரிக்கை' };
          }

          // 2. டோக்கன் செல்லுபடியாகும் பட்சத்தில், பயனரின் தகவலைத் திருப்பி அனுப்பவும்
          // (பாதுகாப்பிற்காக நாம் மீண்டும் DB-ஐ சரிபார்க்கலாம், ஆனால் JWT payload இங்கே போதுமானது)
          return {
              userId: userPayload.userId,
              email: userPayload.email
          };
      },
      {
          // 3. இது மிக முக்கியம்: கோரிக்கையின் headers-ல் 'authorization' இருக்க வேண்டும் என Elysia-விடம் கூறுகிறோம்
          headers: t.Object({
              authorization: t.String({ startsWith: 'Bearer ' }) // டோக்கன் "Bearer " என்று தொடங்க வேண்டும்
          })
      }
    );

    