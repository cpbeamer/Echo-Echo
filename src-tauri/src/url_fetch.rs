//! URL text extraction – Tauri command for fetching and stripping web content.
//!
//! Fetches the raw HTML from a URL, strips tags with a lightweight approach,
//! and returns plain text suitable for use as a data bomb payload.

use std::time::Duration;

/// Maximum response body size (500 KB) to prevent memory issues.
const MAX_BODY_SIZE: usize = 500 * 1024;

/// Fetch a URL and return its content as plain text (HTML tags stripped).
///
/// Applies a 10-second timeout and a 500 KB body limit. Returns a
/// descriptive error if the URL is unreachable or the content is empty.
#[tauri::command]
pub async fn fetch_url_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let resp = client
        .get(&url)
        .header("User-Agent", "SynapticSandbox/0.1 DataBombFetcher")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL '{}': {}", url, e))?;

    if !resp.status().is_success() {
        return Err(format!("URL returned status {}", resp.status()));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    if bytes.len() > MAX_BODY_SIZE {
        return Err(format!(
            "Response too large ({} bytes, max {} bytes)",
            bytes.len(),
            MAX_BODY_SIZE
        ));
    }

    let html = String::from_utf8_lossy(&bytes).to_string();
    let text = strip_html_tags(&html);

    if text.trim().is_empty() {
        return Err("No readable text content found at URL.".into());
    }

    Ok(text)
}

/// Lightweight HTML tag stripper using regex-like manual parsing.
///
/// Strips `<script>`, `<style>`, and `<noscript>` block contents entirely,
/// then removes all remaining HTML tags and collapses whitespace.
fn strip_html_tags(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let chars = html.chars().peekable();
    let mut in_tag = false;
    let mut in_script = false;
    let mut in_style = false;

    // Small buffer for detecting opening/closing tag names
    let mut tag_buf = String::new();
    let mut is_closing_tag = false;

    for ch in chars {
        if ch == '<' {
            in_tag = true;
            tag_buf.clear();
            is_closing_tag = false;
        } else if ch == '>' && in_tag {
            in_tag = false;
            let tag_lower = tag_buf.to_lowercase();
            let tag_name = tag_lower.split_whitespace().next().unwrap_or("");

            if is_closing_tag {
                if tag_name == "script" {
                    in_script = false;
                } else if tag_name == "style" {
                    in_style = false;
                }
            } else if tag_name == "script" {
                in_script = true;
            } else if tag_name == "style" {
                in_style = true;
            }

            // Insert a space where block-level tags were to preserve word boundaries
            if matches!(
                tag_name,
                "p" | "div"
                    | "br"
                    | "h1"
                    | "h2"
                    | "h3"
                    | "h4"
                    | "h5"
                    | "h6"
                    | "li"
                    | "td"
                    | "th"
                    | "tr"
                    | "blockquote"
                    | "pre"
                    | "hr"
            ) {
                result.push(' ');
            }
        } else if in_tag {
            if tag_buf.is_empty() && ch == '/' {
                is_closing_tag = true;
            } else {
                tag_buf.push(ch);
            }
        } else if !in_script && !in_style {
            result.push(ch);
        }
    }

    // Decode common HTML entities
    let result = result
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ");

    // Collapse whitespace
    let mut collapsed = String::with_capacity(result.len());
    let mut last_was_space = false;
    for ch in result.chars() {
        if ch.is_whitespace() {
            if !last_was_space {
                collapsed.push(' ');
                last_was_space = true;
            }
        } else {
            collapsed.push(ch);
            last_was_space = false;
        }
    }

    collapsed.trim().to_string()
}
