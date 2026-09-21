import 'dotenv/config';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5436', 10),
  username: process.env.DB_USERNAME ?? 'job',
  password: process.env.DB_PASSWORD ?? 'protection',
  database: process.env.DB_DATABASE ?? 'conduit-db',
  synchronize: false,
  logging: false,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'migrations',
});
