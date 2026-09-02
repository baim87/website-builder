"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function testR2() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        console.error('❌ Missing R2 credentials in .env');
        return;
    }
    console.log(`Testing connection to R2 bucket: ${bucketName}...`);
    const client = new client_s3_1.S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
    try {
        console.log('Uploading test file...');
        await client.send(new client_s3_1.PutObjectCommand({
            Bucket: bucketName,
            Key: 'test-connection.txt',
            Body: 'Hello from Contractor Website Builder!',
            ContentType: 'text/plain',
        }));
        console.log('✅ Upload successful!');
        console.log('Listing objects...');
        const result = await client.send(new client_s3_1.ListObjectsV2Command({
            Bucket: bucketName,
            MaxKeys: 5,
        }));
        console.log('✅ Connection verified! Found objects:');
        if (result.Contents) {
            result.Contents.forEach(obj => console.log(`   - ${obj.Key} (${obj.Size} bytes)`));
        }
        else {
            console.log('   (No objects found)');
        }
    }
    catch (error) {
        console.error('❌ R2 Error:', error.message);
    }
}
testR2();
//# sourceMappingURL=test-r2.js.map