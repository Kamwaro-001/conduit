import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { UsersService } from './users/users.service.js';
import { UserRole } from './users/entities/user.entity.js';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const email = process.env.ADMIN_EMAIL ?? 'admin@conduit.com';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const existing = await usersService.findByEmail(email);

  if (existing) {
    console.log(`ℹ️  Seed user (${email}) already exists, skipping.`);
  } else {
    await usersService.createWithPassword(email, password, UserRole.ADMIN);
    console.log(`✅ Seed complete — ${email} / ${password}`);
  }

  await app.close();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
