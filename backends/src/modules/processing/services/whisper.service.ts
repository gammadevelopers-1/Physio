import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';

export interface WhisperResult {
  vtt: string;
  plainText: string;
}

@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);
  private client: OpenAI | null = null;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('processing.openai.apiKey');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
    this.model = this.configService.get<string>('processing.openai.whisperModel') || 'whisper-1';
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Generate captions from an audio file.
   * Makes a single API call with verbose_json and converts to VTT + plain text.
   */
  async generateCaptions(audioFilePath: string): Promise<WhisperResult> {
    if (!this.client) throw new Error('OpenAI not configured');

    this.logger.log(`Generating captions from: ${audioFilePath}`);

    // Get VTT format directly from Whisper
    const vttFile = fs.createReadStream(audioFilePath);
    const vttResponse = await this.client.audio.transcriptions.create({
      file: vttFile,
      model: this.model,
      response_format: 'vtt',
    });
    const vtt = vttResponse as unknown as string;

    // Get plain text
    const textFile = fs.createReadStream(audioFilePath);
    const textResponse = await this.client.audio.transcriptions.create({
      file: textFile,
      model: this.model,
      response_format: 'text',
    });
    const plainText = textResponse as unknown as string;

    return { vtt, plainText };
  }
}
