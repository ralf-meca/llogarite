import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Project } from './project.entity';
import { ProjectExpense, ProjectPatch, ProjectsService } from './projects.service';

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

    @Get(':id/expenses')
    findExpenses(@CurrentUser() userId: string, @Param('id') id: string): Promise<ProjectExpense[]> {
        return this.projectsService.findExpenses(userId, id);
    }

    @Post(':id/mark-paid')
    @HttpCode(HttpStatus.OK)
    markPaid(
        @CurrentUser() userId: string,
        @Param('id') id: string,
        @Body() body?: { buddyId?: unknown },
    ): Promise<void> {
        // No buddy named settles everyone, which is what older app versions send.
        const buddyId = typeof body?.buddyId === 'string' && body.buddyId ? body.buddyId : undefined;
        return this.projectsService.markOwnExpensesPaid(userId, id, buddyId);
    }

    @Post(':id/leave')
    @HttpCode(HttpStatus.NO_CONTENT)
    leave(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
        return this.projectsService.leave(userId, id);
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
