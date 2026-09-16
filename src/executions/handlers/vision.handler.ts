import { Injectable, Logger } from '@nestjs/common';
import type { Node } from '../../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './node-handler.interface.js';

@Injectable()
export class VisionHandler implements NodeHandler {
  private readonly logger = new Logger(VisionHandler.name);

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    // Resolve the image URL from the payload using dot notation.
    // e.g. imageUrlField: "node-http-fetch.data.url"
    const imageUrlField: string = node.config?.imageUrlField ?? 'image_url';
    const imageUrl = this.resolvePayloadField(inputPayload, imageUrlField);

    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error(
        `VISION node: no image URL found at payload field "${imageUrlField}"`,
      );
    }

    const prompt: string =
      node.config?.prompt ??
      'Extract all text from this image exactly as it appears. Return only the raw text content, nothing else.';

    this.logger.log(`👁️  VISION: fetching image from ${imageUrl}`);

    // Fetch the image and convert to base64 for the Gemini API.
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new Error(
        `VISION node: failed to fetch image (HTTP ${imgResponse.status})`,
      );
    }
    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBase64 = Buffer.from(imgBuffer).toString('base64');
    const mimeType = imgResponse.headers.get('content-type') ?? 'image/jpeg';

    // Dynamically import so the module is only loaded when needed.
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
    const model = genAI.getGenerativeModel({
      model: node.config?.model ?? 'gemini-3.6-flash',
    });

    const visionResult = await model.generateContent([
      { inlineData: { data: imgBase64, mimeType } },
      prompt,
    ]);

    const extractedText = visionResult.response.text();
    this.logger.log(
      `✅ VISION extracted ${extractedText.length} chars of text`,
    );

    return {
      resultPayload: { imageUrl, extractedText },
    };
  }

  /**
   * Traverse a dot-notation path into a nested payload object.
   * Example: resolvePayloadField(payload, "node-abc.data.media_url")
   * returns payload["node-abc"]["data"]["media_url"]
   */
  private resolvePayloadField(
    payload: Record<string, any>,
    fieldPath: string,
  ): unknown {
    return fieldPath
      .split('.')
      .reduce((obj: any, key: string) => obj?.[key], payload);
  }
}
