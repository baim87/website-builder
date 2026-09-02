"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createS3Client = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const createS3Client = (config) => {
    const r2Endpoint = config.get('R2_ENDPOINT');
    if (r2Endpoint && r2Endpoint.includes('r2.cloudflarestorage.com')) {
        return new client_s3_1.S3Client({
            region: 'auto',
            endpoint: r2Endpoint,
            credentials: {
                accessKeyId: config.get('R2_ACCESS_KEY_ID'),
                secretAccessKey: config.get('R2_SECRET_ACCESS_KEY'),
            },
        });
    }
    return new client_s3_1.S3Client({
        region: 'us-east-1',
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        credentials: {
            accessKeyId: 'minioadmin',
            secretAccessKey: 'minioadmin',
        },
    });
};
exports.createS3Client = createS3Client;
//# sourceMappingURL=storage.config.js.map