import dotenv from 'dotenv';

dotenv.config();

function getMaskedDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return '<missing DATABASE_URL>';
  }

  try {
    const url = new URL(databaseUrl);
    if (url.password) {
      url.password = '******';
    }
    return url.toString();
  } catch {
    return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:******@');
  }
}

async function getSender() {
  let prisma: Awaited<typeof import('./lib/db')>['prisma'] | undefined;

  try {
    console.log('DATABASE_URL:', getMaskedDatabaseUrl());
    ({ prisma } = await import('./lib/db'));

    const sender = await prisma.sender.findFirst();
    if (sender) {
      console.log('✅ Your Sender ID is:', sender.id);
      console.log('✅ Sender Email:', sender.email);
    } else {
      console.log('❌ No sender found. Run npx tsx src/seed.ts first.');
    }
  } catch (error) {
    console.error('❌ Failed to retrieve sender:', error);
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

void getSender();