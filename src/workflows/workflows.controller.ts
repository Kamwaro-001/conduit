import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';
import { UpdateWorkflowDto } from './dto/update-workflow.dto.js';
import { SyncWorkflowDto } from './dto/sync-workflow.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser, type JwtPayload } from '../auth/current-user.decorator.js';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  create(@Body() dto: CreateWorkflowDto, @CurrentUser() user: JwtPayload) {
    return this.workflowsService.create(dto, user.sub);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.workflowsService.findAll(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.workflowsService.findOne(id, user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workflowsService.update(id, dto, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.workflowsService.remove(id, user.sub);
  }

  @Put(':id/sync')
  sync(
    @Param('id') id: string,
    @Body() dto: SyncWorkflowDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workflowsService.sync(id, dto, user.sub);
  }
}
