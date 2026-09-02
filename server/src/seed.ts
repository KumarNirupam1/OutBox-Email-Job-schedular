import dotenv from 'dotenv';

dotenv.config();

let prisma: Awaited<typeof import('./lib/db')>['prisma'];
let createEtherealAccount: typeof import('./utils/ethereal')['createEtherealAccount'];

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

async function seed() {
  console.log('🌱 Seeding database...');
  console.log('DATABASE_URL:', getMaskedDatabaseUrl());
  
  // Find the first user (or create a mock one if none exists from your Google login)
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('❌ No user found. Please log in via Google OAuth first.');
    return;
  }

  // Check if sender already exists
  const existingSender = await prisma.sender.findFirst({ where: { userId: user.id } });
  if (existingSender) {
    console.log('✅ Sender already exists:', existingSender.email);
    return;
  }

  // Create a new Ethereal account
  const etherealAccount = await createEtherealAccount();
  
  const sender = await prisma.sender.create({
    data: {
      userId: user.id,
      email: etherealAccount.email,
      smtpHost: etherealAccount.smtpHost,
      smtpPort: etherealAccount.smtpPort,
      smtpUser: etherealAccount.smtpUser,
      smtpPass: etherealAccount.smtpPass,
    },
  });

  console.log('✅ Created Ethereal Sender:', sender.email);
  console.log('🔗 Preview URL will be available in worker logs when emails are sent.');
}

async function main() {
  let exitCode = 0;

  try {
    ({ prisma } = await import('./lib/db'));
    ({ createEtherealAccount } = await import('./utils/ethereal'));

    // Run `npx prisma generate` after schema changes and before running this script.
    await seed();
  } catch (error) {
    console.error('❌ Database seed failed:', error);
    exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }

  process.exit(exitCode);
}

void main();