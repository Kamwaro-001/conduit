import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { WorkflowsModule } from './workflows/workflows.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionsModule } from './executions/executions.module.js';
import { BullModule } from '@nestjs/bullmq';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TelemetryGateway } from './telemetry/telemetry.gateway.js';

function getRedisConnection() {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl || upstashToken) {
    if (!upstashUrl || !upstashToken) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together',
      );
    }

    const endpoint = new URL(upstashUrl);
    return {
      host: endpoint.hostname,
      port: 6379,
      username: 'default',
      password: upstashToken,
      tls: {},
    };
  }

  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  };
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'job',
      password: process.env.DB_PASSWORD ?? 'protection',
      database: process.env.DB_DATABASE ?? 'conduit-db',
      autoLoadEntities: true,
      synchronize: false,
      ssl: process.env.DB_SSL === 'false' ? false : true,
    }),
    BullModule.forRoot({
      connection: getRedisConnection(),
    }),
    BullModule.registerQueue({
      name: 'node-execution',
    }),
    UsersModule,
    AuthModule,
    WorkflowsModule,
    ExecutionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, TelemetryGateway],
})
export class AppModule {}
