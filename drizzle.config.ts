import 'dotenv/config'; // .env கோப்பை ஏற்றுவதற்காக (drizzle-kit-க்காக)
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  /**
   * திருத்தம் இங்கே: 'driver' என்பதற்கு பதிலாக 'dialect'
   */
  dialect: 'postgresql', // 'pg' அல்ல, 'postgresql'
  dbCredentials: {
    /**
     * திருத்தம் இங்கே: 'connectionString' என்பதற்கு பதிலாக 'url'
     * (மற்றும் .env-ஐ ஏற்றுவதற்காக மேலே 'dotenv/config'-ஐ இறக்குமதி செய்துள்ளோம்)
     */
    url: process.env.DATABASE_URL!, 
  },
} satisfies Config;