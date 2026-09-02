import nodemailer from 'nodemailer';

export async function createEtherealAccount() {
  const testAccount = await nodemailer.createTestAccount();
  return {
    email: testAccount.user,
    smtpHost: testAccount.smtp.host,
    smtpPort: testAccount.smtp.port,
    smtpUser: testAccount.user,
    smtpPass: testAccount.pass,
  };
}

export function getEtherealTransporter(sender: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}) {
  return nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
  });
}