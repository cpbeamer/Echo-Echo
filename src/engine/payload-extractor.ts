/**
 * Payload Extractor – Thin wrappers around Tauri commands for extracting
 * text from PDF files and URLs.
 *
 * These functions are used by the DropZone component to convert non-text
 * payloads into plain text before detonating a data bomb.
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Extract all readable text from a PDF file at the given path.
 *
 * Delegates to the Rust `extract_pdf_text` Tauri command.
 * @throws Error with a descriptive message if extraction fails.
 */
export async function extractPdfText(filePath: string): Promise<string> {
  try {
    return await invoke<string>('extract_pdf_text', { filePath });
  } catch (error) {
    throw new Error(
      `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/**
 * Fetch a URL and return its content as plain text (HTML tags stripped).
 *
 * Delegates to the Rust `fetch_url_text` Tauri command.
 * @throws Error with a descriptive message if fetching fails.
 */
export async function fetchUrlText(url: string): Promise<string> {
  try {
    return await invoke<string>('fetch_url_text', { url });
  } catch (error) {
    throw new Error(
      `URL fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
