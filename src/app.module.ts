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

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5436', 10),
      username: process.env.DB_USERNAME ?? 'job',
      password: process.env.DB_PASSWORD ?? 'protection',
      database: process.env.DB_DATABASE ?? 'conduit-db',
      autoLoadEntities: true,
      synchronize: false,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    BullModule.registerQueue({
      name: 'workflow-execution',
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
