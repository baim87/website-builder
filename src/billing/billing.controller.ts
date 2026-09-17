import { Controller, Get, Post, Body, Req, UseGuards, Headers } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Request } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckoutSession(@CurrentUser('id') userId: string, @Body('planId') planId: string) {
    return this.billingService.createCheckoutSession(userId, planId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getSubscription(@CurrentUser('id') userId: string) {
    return this.billingService.getSubscription(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  async cancelSubscription(@CurrentUser('id') userId: string) {
    return this.billingService.cancelSubscription(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payments')
  async getPayments(@CurrentUser('id') userId: string) {
    return this.billingService.getPayments(userId);
  }

  // Webhooks are not authenticated by JWT, but by Stripe signature
  @Post('webhook')
  async handleWebhook(@Headers('stripe-signature') signature: string, @Req() req: RawBodyRequest<Request>) {
    return this.billingService.handleWebhook(signature, req.rawBody as Buffer);
  }
}
