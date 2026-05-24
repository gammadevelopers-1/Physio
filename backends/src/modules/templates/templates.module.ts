import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { TemplateResolverService } from './template-resolver.service';

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplateResolverService],
  exports: [TemplatesService, TemplateResolverService],
})
export class TemplatesModule {}
