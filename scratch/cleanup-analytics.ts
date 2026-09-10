import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthClient } from '../src/analytics/clients/google-auth.client';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';
import { PrismaService } from '../src/prisma/prisma.service';

async function cleanupAnalytics() {
  console.log('Bootstrapping NestJS for cleanup...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const config = app.get(ConfigService);
  const auth = app.get(GoogleAuthClient);
  const prisma = app.get(PrismaService);
  
  // 1. Cleanup GTM Containers
  console.log('--- Cleaning up GTM Containers ---');
  const gtmApi = google.tagmanager({ version: 'v2', auth: auth.jwtClient });
  const gtmAccountId = config.get('GOOGLE_TAG_MANAGER_ACCOUNT_ID');
  
  try {
    const containersRes = await gtmApi.accounts.containers.list({
      parent: `accounts/${gtmAccountId}`,
    });
    const containers = containersRes.data.container || [];
    
    for (const container of containers) {
      if (container.name && container.name.includes('crushexcavation')) {
        console.log(`Deleting GTM Container: ${container.name} (${container.containerId})`);
        await gtmApi.accounts.containers.delete({
          path: `accounts/${gtmAccountId}/containers/${container.containerId}`
        });
        console.log(`Deleted ${container.name}`);
      }
    }
  } catch (e) {
    console.error('Error cleaning up GTM:', e);
  }

  // 2. Cleanup GA4 Properties
  console.log('--- Cleaning up GA4 Properties ---');
  const gaAccountId = config.get('GOOGLE_ANALYTICS_ACCOUNT_ID');
  const gaAdminClient = new AnalyticsAdminServiceClient({
    credentials: {
      client_email: auth.clientEmail,
      private_key: auth.privateKey?.replace(/\\n/g, '\n'),
    },
  });

  try {
    const [properties] = await gaAdminClient.listProperties({
      filter: `parent:accounts/${gaAccountId}`,
    });
    
    for (const property of properties) {
      if (property.displayName && property.displayName.includes('crushexcavation')) {
        console.log(`Deleting GA4 Property: ${property.displayName} (${property.name})`);
        await gaAdminClient.deleteProperty({
          name: property.name,
        });
        console.log(`Deleted ${property.displayName}`);
      }
    }
  } catch (e) {
    console.error('Error cleaning up GA4:', e);
  }

  // 3. Cleanup Database Records
  console.log('--- Cleaning up Database Records ---');
  try {
    const deleted = await prisma.siteAnalytics.deleteMany({
      where: {
        gscSiteUrl: {
          contains: 'crushexcavation',
        }
      }
    });
    console.log(`Deleted ${deleted.count} SiteAnalytics records`);
  } catch (e) {
    console.error('Error cleaning up Database:', e);
  }

  console.log('Cleanup complete!');
  await app.close();
}

cleanupAnalytics().catch(console.error);
