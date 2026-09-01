"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GbpModule = void 0;
const common_1 = require("@nestjs/common");
const gbp_service_1 = require("./gbp.service");
const gbp_controller_1 = require("./gbp.controller");
let GbpModule = class GbpModule {
};
exports.GbpModule = GbpModule;
exports.GbpModule = GbpModule = __decorate([
    (0, common_1.Module)({
        controllers: [gbp_controller_1.GbpController],
        providers: [gbp_service_1.GbpService],
        exports: [gbp_service_1.GbpService],
    })
], GbpModule);
//# sourceMappingURL=gbp.module.js.map