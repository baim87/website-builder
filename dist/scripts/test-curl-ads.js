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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function testCurl() {
    try {
        const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
        console.log('1. Fetching Access Token...');
        const tokenRes = await axios_1.default.post('https://oauth2.googleapis.com/token', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            },
        });
        const accessToken = tokenRes.data.access_token;
        console.log('Got Access Token. Length:', accessToken.length);
        console.log('2. Curling Google Ads API for Keyword Ideas...');
        const requestBody = {
            keywordSeed: {
                keywords: ['Kitchen Remodeling Peoria, AZ']
            },
            pageSize: 15
        };
        const apiRes = await axios_1.default.post(`https://googleads.googleapis.com/v25/customers/${customerId}:generateKeywordIdeas`, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
                'Content-Type': 'application/json'
            }
        });
        console.log('SUCCESS API Response:', JSON.stringify(apiRes.data).substring(0, 500));
    }
    catch (err) {
        console.error('CURL ERROR:');
        if (err.response) {
            console.error(JSON.stringify(err.response.data, null, 2));
        }
        else {
            console.error(err.message);
        }
    }
}
testCurl();
//# sourceMappingURL=test-curl-ads.js.map