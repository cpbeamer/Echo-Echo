import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tauri-apps/api/core before importing the module under test
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { extractPdfText, fetchUrlText } from '../src/engine/payload-extractor';
import { invoke } from '@tauri-apps/api/core';

const mockedInvoke = vi.mocked(invoke);

describe('Payload Extractor', () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  describe('extractPdfText', () => {
    it('calls invoke with extract_pdf_text and file path', async () => {
      mockedInvoke.mockResolvedValueOnce('Extracted PDF content here.');

      const result = await extractPdfText('/path/to/document.pdf');

      expect(mockedInvoke).toHaveBeenCalledOnce();
      expect(mockedInvoke).toHaveBeenCalledWith('extract_pdf_text', {
        filePath: '/path/to/document.pdf',
      });
      expect(result).toBe('Extracted PDF content here.');
    });

    it('wraps Tauri errors in a descriptive Error', async () => {
      mockedInvoke.mockRejectedValueOnce('File not found');

      await expect(extractPdfText('/bad/path.pdf')).rejects.toThrow(
        'PDF extraction failed: File not found',
      );
    });

    it('handles Error objects from Tauri', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(extractPdfText('/restricted.pdf')).rejects.toThrow(
        'PDF extraction failed: Permission denied',
      );
    });
  });

  describe('fetchUrlText', () => {
    it('calls invoke with fetch_url_text and url', async () => {
      mockedInvoke.mockResolvedValueOnce('Hello World page content');

      const result = await fetchUrlText('https://example.com');

      expect(mockedInvoke).toHaveBeenCalledOnce();
      expect(mockedInvoke).toHaveBeenCalledWith('fetch_url_text', {
        url: 'https://example.com',
      });
      expect(result).toBe('Hello World page content');
    });

    it('wraps Tauri errors in a descriptive Error', async () => {
      mockedInvoke.mockRejectedValueOnce('Network timeout');

      await expect(fetchUrlText('https://unreachable.test')).rejects.toThrow(
        'URL fetch failed: Network timeout',
      );
    });

    it('handles Error objects from Tauri', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('Status 404'));

      await expect(fetchUrlText('https://example.com/missing')).rejects.toThrow(
        'URL fetch failed: Status 404',
      );
    });
  });
});
