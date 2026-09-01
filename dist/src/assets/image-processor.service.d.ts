import sharp = require('sharp');
export declare class ImageProcessorService {
    private readonly logger;
    convertToWebp(buffer: Buffer): Promise<Buffer>;
    extractMetadata(buffer: Buffer): Promise<{
        width: number;
        height: number;
        format: keyof sharp.FormatEnum;
    } | null>;
}
