import { Elysia } from 'elysia';
import { db, schema } from './db'; // நாம் படி 4-ல் உருவாக்கிய DB இணைப்பு மற்றும் ஸ்கீமா
import { authController } from './controllers/auth.controller';
import { swagger } from '@elysiajs/swagger';

const app = new Elysia()
    /**
     * இதுதான் சரியான "latest docs" முறை.
     * பிளகின் தேவையில்லை. நமது db இணைப்பை Elysia-வின் context-ல் நேரடியாக 'decorate' செய்கிறோம்.
     * இது அனைத்து வழிகளிலும் (routes) 'db' மற்றும் 'schema'-வை கிடைக்கச் செய்யும்.
     */
    .decorate({ db })
    .decorate({ schema })
     .use(swagger({
      path: '/swagger', // இதுதான் ஆவணங்கள் இருக்கும் URL
      documentation: {
        info: {
          title: 'நமது டிரேடிங் பிளாட்ஃபார்ம் API',
          version: '1.0.0'
        }
      }
    }))

    // Auth Controller-ஐ இங்கே இணைக்கவும்
    .use(authController) // <-- /auth/signup வழியை இது சேர்க்கும்

    // சர்வர் மற்றும் DB இணைப்பை சோதித்தல்
    .get('/', async ({ db }) => {
        // இப்போது 'db' context-ல் கிடைக்கிறது!
        // நாம் db.query.platformUsers... என்று நேரடியாக வினவலாம்.
        try {
            await db.query.platformUsers.findFirst(); // DB-ஐ வினவ முயற்சிக்கவும்
            return { status: 'Server Running', db_status: 'Connected' };
        } catch (e: any) {
            return { status: 'Server Running', db_status: 'Connection Failed', error: e.message };
        }
    })
  
    .listen(3000);

console.log(
  `🦊 Elysia சர்வர் http://${app.server?.hostname}:${app.server?.port} -ல் இயங்குகிறது`
);