import { Injectable } from '@nestjs/common';

export interface WcagResult {
  status: 'pass' | 'warning' | 'fail';
  details: string[];
}

@Injectable()
export class WcagService {
  /**
   * Check WCAG compliance for a material.
   * Returns 'pass', 'warning', or 'fail' based on accessibility criteria.
   */
  checkCompliance(params: {
    materialType: string;
    hasCaptions: boolean;
    hasTranscript: boolean;
  }): WcagResult {
    const details: string[] = [];
    let score = 100;

    if (params.materialType === 'video') {
      if (!params.hasCaptions) {
        details.push('Missing captions (WCAG 1.2.2)');
        score -= 50;
      } else {
        details.push('Captions present (WCAG 1.2.2)');
      }

      if (!params.hasTranscript) {
        details.push('Missing transcript (WCAG 1.2.3)');
        score -= 25;
      } else {
        details.push('Transcript present (WCAG 1.2.3)');
      }
    }

    if (params.materialType === 'image') {
      details.push('Alt text assumed from title (WCAG 1.1.1)');
    }

    if (params.materialType === 'pdf') {
      details.push('PDF accessibility not fully verified');
      score -= 10;
    }

    if (params.materialType === 'document') {
      details.push('Document accessibility not fully verified');
      score -= 10;
    }

    const status = score >= 75 ? 'pass' : score >= 50 ? 'warning' : 'fail';
    return { status, details };
  }
}
