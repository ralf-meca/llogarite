import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { Project } from './project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
    imports: [TypeOrmModule.forFeature([Project, Invoice])],
    controllers: [ProjectsController],
    providers: [ProjectsService],
})
export class ProjectsModule {}
