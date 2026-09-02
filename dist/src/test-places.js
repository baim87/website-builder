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
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function main() {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        console.error('No GOOGLE_PLACES_API_KEY');
        return;
    }
    const location = 'Peoria, Arizona';
    const radiusMiles = 10;
    const radiusMeters = Math.min(radiusMiles * 1609.34, 50000);
    try {
        const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.location',
            },
            body: JSON.stringify({ textQuery: location }),
        });
        const searchData = await searchRes.json();
        if (!searchData.places || searchData.places.length === 0) {
            console.log('Location not found');
            return;
        }
        const center = searchData.places[0].location;
        console.log('Center:', center);
        const nearbyRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress',
            },
            body: JSON.stringify({
                includedTypes: ['locality'],
                locationRestriction: {
                    circle: {
                        center,
                        radius: radiusMeters
                    }
                },
                maxResultCount: 20
            }),
        });
        const nearbyData = await nearbyRes.json();
        console.log('Nearby:', JSON.stringify(nearbyData, null, 2));
    }
    catch (e) {
        console.error(e);
    }
}
main();
//# sourceMappingURL=test-places.js.map