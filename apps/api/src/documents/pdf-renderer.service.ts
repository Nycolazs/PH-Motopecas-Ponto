import { Injectable, Logger } from '@nestjs/common';
import { chromium, type Browser } from 'playwright-core';

export interface RenderPdfOptions {
  format?: 'A4' | 'Letter';
  landscape?: boolean;
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

@Injectable()
export class PdfRendererService {
  private readonly logger = new Logger(PdfRendererService.name);
  private browserInstance: Browser | null = null;

  public async getBrowser(): Promise<Browser> {
    if (!this.browserInstance || !this.browserInstance.isConnected()) {
      this.browserInstance = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browserInstance;
  }

  public async renderHtmlToPdf(html: string, options: RenderPdfOptions = {}): Promise<Buffer> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1200, height: 1600 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    try {
      // Set secure navigation policies - prevent loading remote scripts/resources
      await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('data:') || url === 'about:blank') {
          return route.continue();
        }
        return route.abort('blockedbyclient');
      });

      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 15000,
      });

      const pdfUint8Array = await page.pdf({
        format: options.format ?? 'A4',
        landscape: options.landscape ?? false,
        printBackground: true,
        margin: {
          top: options.margin?.top ?? '15mm',
          bottom: options.margin?.bottom ?? '15mm',
          left: options.margin?.left ?? '15mm',
          right: options.margin?.right ?? '15mm',
        },
      });

      return Buffer.from(pdfUint8Array);
    } catch (err) {
      this.logger.error('Error rendering HTML to PDF:', err);
      throw err;
    } finally {
      await page.close();
      await context.close();
    }
  }

  public async onApplicationShutdown(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }
}
