import { PrismaPg } from '@prisma/adapter-pg';
import { hash, argon2id } from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: 'postgresql://ph_ponto:ph_ponto_dev@127.0.0.1:5432/ph_ponto?schema=public',
});
const prisma = new PrismaClient({ adapter });

async function reset() {
  const passwordHash = await hash('development-bootstrap-password-change-me', {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  });
  await prisma.user.updateMany({
    where: { role: 'ADMIN' },
    data: { passwordHash, isActive: true },
  });
  console.log('Admin password reset to development-bootstrap-password-change-me');
  await prisma.$disconnect();
}
reset();
