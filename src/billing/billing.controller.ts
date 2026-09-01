import { Controller, Get, Post, Body, Req, UseGuards, Headers } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Request } from 'express';

// Ensure the Request type has user property attached by JwtAuthGuard
interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckoutSession(@Req() req: AuthenticatedRequest, @Body('planId') planId: string) {
    return this.billingService.createCheckoutSession(req.user.userId, planId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getSubscription(@Req() req: AuthenticatedRequest) {
    return this.billingService.getSubscription(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  async cancelSubscription(@Req() req: AuthenticatedRequest) {
    return this.billingService.cancelSubscription(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payments')
  async getPayments(@Req() req: AuthenticatedRequest) {
    return this.billingService.getPayments(req.user.userId);
  }

  // Webhooks are not authenticated by JWT, but by Stripe signature
  @Post('webhook')
  async handleWebhook(@Headers('stripe-signature') signature: string, @Req() req: RawBodyRequest<Request>) {
    return this.billingService.handleWebhook(signature, req.rawBody as Buffer);
  }
}
