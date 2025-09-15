import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * படி 4-ல் நாம் உருவாக்கிய ./schema.ts கோப்பிலிருந்து 
 * 'schema' என்ற பெயரிடப்பட்ட பொருளை (named object) இறக்குமதி செய்யவும்.
 */
import { schema } from './schema'; 

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

// 1. db இணைப்பை (drizzle instance) உருவாக்கவும் (இதை நாம் ஏற்கனவே செய்தோம்)
export const db = drizzle(client, { schema });

/**
 * 2. இதுதான் திருத்தம் (THE FIX):
 * நமது பிரதான src/index.ts கோப்பு பயன்படுத்துவதற்காக, 
 * நாம் மேலே இறக்குமதி செய்த அதே 'schema' பொருளை இங்கேயும் export செய்யவும்.
 */
export { schema };