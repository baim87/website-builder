import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssetPathResolverService } from './asset-path-resolver.service';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { ImageOptimizationService } from '../images/image-optimization.service';

@Injectable()
export class PortraitGenerationService {
  private readonly logger = new Logger(PortraitGenerationService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly imageOptimization: ImageOptimizationService,
    private readonly pathResolver: AssetPathResolverService,
  ) {}

  async generatePortrait(projectId: string, trade: string, localImagePath: string) {
    let imageBuffer: Buffer;
    let mimeType = 'image/jpeg';
    
    if (localImagePath.startsWith('http://') || localImagePath.startsWith('https://')) {
      this.logger.log(`Fetching remote reference image from ${localImagePath}`);
      const res = await axios.get(localImagePath, { 
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      imageBuffer = Buffer.from(res.data);
      mimeType = (res.headers['content-type'] as string) || mimeType;
    } else {
      if (!fs.existsSync(localImagePath)) {
        throw new Error(`File not found at ${localImagePath}`);
      }
      imageBuffer = fs.readFileSync(localImagePath);
      if (localImagePath.endsWith('.png')) mimeType = 'image/png';
      else if (localImagePath.endsWith('.webp')) mimeType = 'image/webp';
    }

    const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    const prompt = `Create a world-class professional commercial portrait of a US home-service contractor, using the provided reference photo as the primary identity and appearance reference.

SUBJECT:
A confident, approachable American home contractor specializing in ${trade}.

Preserve the person's recognizable facial structure, approximate age, hairstyle, skin tone, facial hair, and overall appearance from the reference image. The person should look like the same real individual, not a generic model.

The expression should communicate:
- trustworthy
- experienced
- confident
- approachable
- hardworking
- professional

Use a subtle natural smile with genuine warmth. Relaxed facial muscles, natural eyes, authentic expression. Avoid an exaggerated smile or artificial "stock photo" expression.

WARDROBE:
Dress the contractor in premium, realistic professional workwear appropriate for a successful US home-services company.

A clean, well-fitted dark canvas work shirt or premium polo. Ensure the clothing looks naturally worn and realistic, with authentic fabric texture, stitching, folds, and subtle imperfections. No logos or branding should be visible on the shirt.

Do not make the clothing look like a fashion model's outfit.

POSE:
Three-quarter portrait, standing naturally with relaxed shoulders and confident posture.

Body turned slightly away from camera while the face remains directed toward the camera.

Natural head position, subtle asymmetry, relaxed arms and shoulders.

Frame from approximately mid-chest upward.

The composition should feel intentional and premium while still looking natural and approachable.

CAMERA:
Photographed with a high-end full-frame professional mirrorless or DSLR camera.

50mm prime lens.
Aperture: f/2.0.
Shutter speed approximately 1/200 sec.
ISO kept low for clean professional image quality.

Natural perspective with realistic facial proportions.

Professional portrait photography with precise focus on the eyes.

Eyes must be critically sharp while the ears, shoulders, and background gradually fall out of focus.

Natural optical depth of field rather than artificial computational blur.

LIGHTING:
Professional commercial portrait studio lighting.

Use a large soft key light positioned approximately 45 degrees from the subject, creating soft, flattering directional illumination across the face.

Add subtle fill light from the opposite side to preserve natural facial detail without eliminating dimensionality.

Use a gentle rim/separation light behind the subject to create subtle separation from the background.

Lighting should create realistic skin highlights, soft shadows beneath the chin and around the nose, natural cheek definition, and subtle catchlights in the eyes.

Skin should retain authentic texture and pores.

No beauty-filter appearance.
No excessive skin smoothing.
No plastic skin.

BACKGROUND:
Clean premium professional studio environment inspired by a high-end US home-services brand.

Use a warm neutral architectural background with subtle visual references to residential construction, such as softly blurred wood, natural materials, workshop textures, or a modern residential interior.

The background should remain understated and secondary to the subject.

Use realistic shallow depth of field with smooth natural bokeh.

The background should look like a real physical location photographed with a 50mm lens, not a digitally generated background.

COLOR:
Premium commercial photography color grading.

Natural skin tones.
Neutral-to-warm white balance.
Balanced contrast.
Soft highlight roll-off.
Natural shadow detail.
Subtle professional color correction.

Avoid excessive orange skin, teal-and-orange grading, HDR effects, oversaturation, or cinematic color effects.

REALISM:
Maximum photographic realism.

Include subtle characteristics of a real professional photograph:
- natural skin pores
- fine facial hair
- individual hair strands
- subtle skin imperfections
- realistic eye moisture and catchlights
- natural teeth
- realistic fabric texture
- tiny clothing wrinkles
- realistic shadows
- subtle ambient light bounce
- physically accurate reflections
- realistic depth of field
- natural lens characteristics
- extremely subtle photographic grain

The subject must look like a real contractor photographed by an experienced commercial photographer.

COMPOSITION:
Premium American corporate portrait photography.

Clean, confident, approachable, trustworthy.

Leave a small amount of natural headroom.

Subject positioned slightly off-center rather than perfectly centered.

Eye line close to the upper third of the frame.

Natural perspective and proportions.

The final result should look suitable for a high-end US remodeling or home-services company's website, marketing materials, advertisements, truck graphics, proposals, and professional company profile.

QUALITY:
Photorealistic professional commercial photography.
High dynamic range without HDR appearance.
Extremely detailed but natural.
Accurate anatomy.
Accurate facial proportions.
Natural skin texture.
Professional studio-quality lighting.
Realistic optics.
No artificial-looking details.
No uncanny facial features.
No excessive symmetry.
No generic stock-photo appearance.
No AI-looking artifacts.`;
    
    this.logger.log(`Calling OpenRouter for portrait generation using bytedance-seed/seedream-4.5...`);
    
    const contentBlocks: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: base64Image } }
    ];

    const messages = [
      {
        role: "user",
        content: contentBlocks
      }
    ];

    const openRouterResponse = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'bytedance-seed/seedream-4.5',
        messages
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Contractor Website Builder',
          'Content-Type': 'application/json'
        }
      }
    );
    
    const message = openRouterResponse.data.choices[0].message;
    const content = message.content || "";
    const cost = openRouterResponse.data.usage?.cost || 0;
    
    let imageUrl = '';
    if (message.images && message.images.length > 0) {
      imageUrl = message.images[0].image_url.url;
    } else {
      const urlMatch = content.match(/!\[.*?\]\((https?:\/\/.*?)\)/);
      if (urlMatch && urlMatch[1]) {
        imageUrl = urlMatch[1];
      } else if (content.startsWith("http")) {
        imageUrl = content.trim();
      }
    }
    
    if (!imageUrl) {
      throw new Error("Could not parse image URL from AI response.");
    }
    
    this.logger.log(`Downloading generated portrait from ${imageUrl}`);
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const generatedBuffer = Buffer.from(imgRes.data);
    
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const userId = project ? project.userId : 'unknown-user';

    // Use AssetPathResolverService as SSOT for path structure
    const imgHash = crypto.createHash('md5').update(generatedBuffer).digest('hex');
    const { originalKey, webpKey } = this.pathResolver.resolveStoragePath(
      userId, projectId, 'portrait', 'owner', imgHash
    );
    await this.storageService.upload(originalKey, generatedBuffer, 'image/jpeg');

    // Optimize to WebP and upload
    const webpBuffer = await this.imageOptimization.optimizeToWebp(generatedBuffer);
    const uploadedWebpUrl = await this.storageService.upload(webpKey, webpBuffer, 'image/webp');
    
    await this.prisma.asset.create({
      data: {
        projectId,
        url: uploadedWebpUrl,
        type: 'image',
        purpose: 'portrait',
        section: 'about',
      },
    });
    
    this.logger.log(`Portrait saved to DB: ${uploadedWebpUrl}, Cost: $${cost}`);

    return uploadedWebpUrl;
  }
}
