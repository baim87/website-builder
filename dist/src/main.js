"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { rawBody: true });
    app.setGlobalPrefix('api');
    app.use((0, cookie_parser_1.default)());
    app.enableCors({
        origin: (origin, callback) => {
            const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3001';
            if (!origin || origin === allowedOrigin || /\.vercel\.app$/.test(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    });
    if (process.env.APP_MODE === 'worker') {
        await app.init();
        console.log('Worker initialized (no HTTP server)');
    }
    else {
        const port = process.env.PORT ?? 3000;
        await app.listen(port);
        console.log(`API server listening on port ${port}`);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map