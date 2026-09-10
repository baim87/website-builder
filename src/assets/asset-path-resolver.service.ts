import { Injectable } from '@nestjs/common';

@Injectable()
export class AssetPathResolverService {
  /**
   * Resolves the R2 folder path and base filename for a given asset.
   * Ensures SSOT for multi-tenant asset storage hierarchy.
   */
  resolveStoragePath(
    userId: string,
    projectId: string,
    assetType: string,
    serviceName: string,
    projectAssetId: string
  ): { folderPath: string; fileNameBase: string; originalKey: string; webpKey: string } {
    const dateStr = new Date().toISOString().split('T')[0];
    const shortId = projectAssetId.split('-')[0]; // use first chunk of uuid for uniqueness
    
    let folderPath = '';
    let fileNameBase = '';
    
    if (assetType === 'BEFORE' || assetType === 'AFTER') {
      folderPath = `${userId}/projects/${projectId}/assets/images/before-after/${serviceName}`;
      fileNameBase = `${assetType.toLowerCase()}-${serviceName}-${dateStr}-${shortId}`;
    } else if (assetType === 'GALLERY') {
      folderPath = `${userId}/projects/${projectId}/assets/images/galleries/${serviceName}`;
      fileNameBase = `${dateStr}-${shortId}`;
    } else {
      folderPath = `${userId}/projects/${projectId}/assets/images/${assetType.toLowerCase().replace('_', '-')}`;
      fileNameBase = `${dateStr}-${shortId}`;
    }

    const originalKey = `${folderPath}/${fileNameBase}-original.jpg`;
    const webpKey = `${folderPath}/${fileNameBase}.webp`;

    return { folderPath, fileNameBase, originalKey, webpKey };
  }

  /**
   * Resolves the global R2 path for partner brand logos (shared CDN).
   */
  resolveGlobalBrandLogoPath(domain: string, extension: string): string {
    return `global/brands/${domain}/logo.${extension}`;
  }
}
