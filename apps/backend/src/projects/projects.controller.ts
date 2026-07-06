import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Project } from './project.entity';
import { ProjectPatch, ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) {}

    @Post()
    create(@CurrentUser() userId: string, @Body() data: ProjectPatch): Promise<Project> {
        return this.projectsService.create(userId, data);
    }

    @Get()
    findAll(@CurrentUser() userId: string): Promise<Project[]> {
        return this.projectsService.findAll(userId);
    }

    @Patch(':id')
    update(
        @CurrentUser() userId: string,
        @Param('id') id: string,
        @Body() data: ProjectPatch,
    ): Promise<Project> {
        return this.projectsService.update(userId, id, data);
    }

    @Delete(':id')
    remove(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
        return this.projectsService.remove(userId, id);
    }
}
