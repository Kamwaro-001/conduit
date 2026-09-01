import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { WorkflowsModule } from './workflows/workflows.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionsModule } from './executions/executions.module.js';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5436,
      username: 'job',
      password: 'protection',
      database: 'conduit-db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    WorkflowsModule,
    ExecutionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
