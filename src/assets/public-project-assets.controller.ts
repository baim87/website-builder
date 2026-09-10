import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('public/project-assets')
export class PublicProjectAssetsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async getProjectAsset(@Param('id') id: string) {
    const asset = await this.prisma.projectAsset.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        webpUrl: true,
      }
    });

    if (!asset) {
      throw new NotFoundException(`Project Asset with ID ${id} not found`);
    }

    return asset;
  }
}
