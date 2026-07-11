import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { CourseCompletionCronService } from './course-completion.cron';

@Injectable()
export class CoursesCompletionJob implements JobHandler {
  readonly name = 'courses.completion';

  constructor(
    registry: JobRegistry,
    private readonly cron: CourseCompletionCronService,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.cron.autoCompletePastEndDate();
  }
}
