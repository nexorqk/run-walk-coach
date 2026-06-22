import "dotenv/config";
import { prisma } from "./prisma.js";

const anonymousUserRetentionDays = Number(process.env.ANONYMOUS_USER_RETENTION_DAYS ?? 7);

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function main() {
  const now = new Date();
  const anonymousCutoff = daysAgo(anonymousUserRetentionDays);
  const expiredSessions = await prisma.authSession.deleteMany({
    where: {
      expiresAt: {
        lt: now
      }
    }
  });
  const anonymousUsers = await prisma.user.deleteMany({
    where: {
      email: null,
      createdAt: {
        lt: anonymousCutoff
      },
      sessions: {
        none: {}
      },
      templates: {
        none: {}
      },
      recoveryCode: null,
      authSessions: {
        none: {}
      }
    }
  });

  console.log(
    JSON.stringify({
      expiredSessions: expiredSessions.count,
      abandonedAnonymousUsers: anonymousUsers.count
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
