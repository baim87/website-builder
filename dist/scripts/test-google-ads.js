"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const google_ads_client_1 = require("../src/keywords/clients/google-ads.client");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const googleAdsClient = app.get(google_ads_client_1.GoogleAdsClient);
    try {
        console.log('Testing Google Ads Client...');
        const results = await googleAdsClient.fetchKeywords('Kitchen Remodeling', 'Peoria, AZ');
        console.log('Success! Results:', results);
    }
    catch (error) {
        console.error('Error Message:', error.message);
    }
    await app.close();
    process.exit(0);
}
bootstrap();
//# sourceMappingURL=test-google-ads.js.map