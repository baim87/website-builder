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
      folderPath = `users/${userId}/projects/${projectId}/assets/images/before-after/${serviceName}`;
      fileNameBase = `${assetType.toLowerCase()}-${serviceName}-${dateStr}-${shortId}`;
    } else if (assetType === 'GALLERY') {
      folderPath = `users/${userId}/projects/${projectId}/assets/images/galleries/${serviceName}`;
      fileNameBase = `${dateStr}-${shortId}`;
    } else {
      folderPath = `users/${userId}/projects/${projectId}/assets/images/${assetType.toLowerCase().replace('_', '-')}`;
      fileNameBase = `${dateStr}-${shortId}`;
    }

    const originalKey = `${folderPath}/${fileNameBase}-original.jpg`;
    const webpKey = `${folderPath}/${fileNameBase}.webp`;

    return { folderPath, fileNameBase, originalKey, webpKey };
  }

  /**
   * Resolves the R2 folder path for brand assets (logos, favicons) preserving extensions.
   */
  resolveBrandAssetPath(
    userId: string,
    projectId: string,
    purpose: 'logo' | 'favicon',
    extension: string,
    projectAssetId: string
  ): { folderPath: string; key: string } {
    const shortId = projectAssetId.split('-')[0];
    const folderPath = `users/${userId}/projects/${projectId}/assets/images/${purpose}`;
    // E.g., users/user_1/projects/proj_2/assets/images/logo/logo-a1b2c3d4.png
    const key = `${folderPath}/${purpose}-${shortId}.${extension}`;
    
    return { folderPath, key };
  }

  /**
   * Resolves the global R2 path for partner brand logos (shared CDN).
   */
  resolveGlobalBrandLogoPath(domain: string, extension: string): string {
    return `global/brands/${domain}/logo.${extension}`;
  }
}
