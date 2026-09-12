import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Guardrail: Ensure we only run this in a local environment
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('rds.amazonaws.com') || process.env.DATABASE_URL?.includes('supabase')) {
    console.error('❌ ERROR: This script can ONLY be executed in the local development environment!');
    console.error('Current NODE_ENV:', process.env.NODE_ENV);
    process.exit(1);
  }

  // Double check it's localhost
  if (!process.env.DATABASE_URL?.includes('localhost') && !process.env.DATABASE_URL?.includes('127.0.0.1') && !process.env.DATABASE_URL?.includes('host.docker.internal') && !process.env.DATABASE_URL?.includes('@postgres:5432')) {
      console.error('❌ ERROR: DATABASE_URL does not look like a local database! Aborting to prevent accidental data loss.');
      process.exit(1);
  }

  console.log('⚠️ Starting complete database reset...');

  try {
    // We run a raw SQL command to TRUNCATE all tables and CASCADE the deletions.
    // This removes all data from all tables (users, projects, components, chat messages, etc.) 
    // without dropping the actual schema.
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations') LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    console.log('✅ Database completely wiped and started fresh!');
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
