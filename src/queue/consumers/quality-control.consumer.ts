import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { QCOrchestratorService } from '../../quality-control/qc-orchestrator.service';
import { QualityControlJobData } from '../interfaces/job-data.interface';

@Processor(QUEUE_NAMES.QUALITY_CONTROL)
export class QualityControlConsumer extends WorkerHost {
  constructor(
    private readonly qcOrchestrator: QCOrchestratorService
  ) {
    super();
  }

  async process(job: Job<QualityControlJobData & any>) {
    return this.qcOrchestrator.orchestrate(job);
  }
}
