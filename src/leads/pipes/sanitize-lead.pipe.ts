import { PipeTransform, Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizeLeadPipe implements PipeTransform {
  transform(value: any) {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const sanitizeOptions = {
      allowedTags: [], // Strip all HTML tags
      allowedAttributes: {}
    };

    const sanitizedData: any = {};

    for (const key of Object.keys(value)) {
      const field = value[key];
      if (typeof field === 'string') {
        sanitizedData[key] = sanitizeHtml(field, sanitizeOptions);
      } else if (typeof field === 'object' && field !== null) {
        // Deep clone / sanitize if it's nested (like metadata)
        sanitizedData[key] = this.transform(field);
      } else {
        sanitizedData[key] = field;
      }
    }

    return sanitizedData;
  }
}
