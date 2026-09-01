import { Controller } from '@nestjs/common';
import { ExecutionsService } from './executions.service.js';

@Controller('executions')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}
}
