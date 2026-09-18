import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer-core';
import { ENV } from '../config/env.constants';

@Injectable()
export class BrowserlessService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserlessService.name);
  private browser: puppeteer.Browser | null = null;
  private readonly wsEndpoint: string;

  constructor(private readonly configService: ConfigService) {
    this.wsEndpoint = this.configService.get<string>(ENV.BROWSERLESS_WS_ENDPOINT) || 'ws://browserless:3000';
  }

  async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }
    
    this.logger.log(`Connecting to browserless at ${this.wsEndpoint}`);
    try {
      this.browser = await puppeteer.connect({
        browserWSEndpoint: this.wsEndpoint,
        defaultViewport: null,
      });
      return this.browser;
    } catch (e) {
      this.logger.error(`Failed to connect to Browserless: ${e.message}`);
      throw e;
    }
  }

  async captureFullPage(url: string, isMobile: boolean): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    try {
      if (isMobile) {
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
      } else {
        await page.setViewport({ width: 1920, height: 1080, isMobile: false, hasTouch: false });
      }

      this.logger.log(`Navigating to ${url} (mobile: ${isMobile})...`);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // Additional wait to ensure React hydration and animations complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Anthropic has an 8000px dimension limit
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportWidth = isMobile ? 375 : 1920;
      const clipHeight = Math.min(bodyHeight, 8000);

      this.logger.log(`Capturing screenshot for ${url} (Height: ${clipHeight}px, max: 8000px)...`);
      const screenshotBuffer = await page.screenshot({ 
        clip: { x: 0, y: 0, width: viewportWidth, height: clipHeight },
        encoding: 'base64', 
        type: 'jpeg', 
        quality: 80 // Compresses it nicely for the AI to save bandwidth
      });
      
      return screenshotBuffer as string;
    } catch (e) {
      this.logger.error(`Failed to capture screenshot for ${url}: ${e.message}`);
      throw e;
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      this.logger.log('Disconnecting from Browserless...');
      this.browser.disconnect();
    }
  }
}
