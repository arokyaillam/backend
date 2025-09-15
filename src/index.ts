import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger'; // <-- (நாம் படி 9-ல் நிறுவிய Swagger)
import { db, schema } from './db'; 
import { authController } from './controllers/auth.controller'; // <-- (நாம் படி 8, 10, 11-ல் உருவாக்கிய Auth Controller)

const app = new Elysia()
    // 1. DB மற்றும் ஸ்கீமாவை Decorate செய்யவும் (இது ஏற்கனவே உங்கள் கோப்பில் உள்ளது)
    .decorate({ db })
    .decorate({ schema })
    
    /**
     * 2. Swagger UI பிளகினை இங்கே இணைக்கவும்
     * இதுதான் hi/swagger' endpoint-ஐ உருவாக்கும்.
     */
    .use(swagger({
      path: '/swagger', 
      documentation: {
        info: {
          title: 'டிரேடிங் பிளாட்ஃபார்ம் API',
          version: '1.0.0'
        }
      }
    }))

    /**
     * 3. நமது Auth Controller-ஐ இங்கே இணைக்கவும்
     * இதுதான் '/auth/signup', '/auth/login', மற்றும் '/auth/me' endpoints-களை உருவாக்கும்.
     */
    .use(authController) 

    // உங்கள் முந்தைய ரூட் டெஸ்ட் Endpoint
    .get('/', async ({ db }) => {
        try {
            await db.query.platformUsers.findFirst(); 
            return { status: 'Server Running', db_status: 'Connected' };
        } catch (e: any) {
            return { status: 'Server Running', db_status: 'Connection Failed', error: e.message };
        }
    })
  
    .listen(3001);

console.log(
  `🦊 Elysia சர்வர் http://${app.server?.hostname}:${app.server?.port} -ல் இயங்குகிறது`
);
console.log(
  `📄 API ஆவணங்கள் (Swagger UI) இங்கே: http://${app.server?.hostname}:${app.server?.port}/swagger`
);