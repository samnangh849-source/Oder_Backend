import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { Parser } from 'm3u8-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3001;

  // 1. Endpoint to scrape the actual .m3u8 link from the iframe page
  app.get('/api/extract-m3u8', async (req, res) => {
    console.log(`[DEBUG] Received request for /api/extract-m3u8: ${req.query.url}`);
    const iframeUrl = req.query.url as string;
    const referer = req.query.referer as string;

    if (!iframeUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      console.log(`Extracting from iframe: ${iframeUrl}`);
      
      const targetOrigin = new URL(iframeUrl).origin;
      const fetchReferer = referer || targetOrigin;
      // Fetch the iframe HTML content
      const response = await fetch(iframeUrl, {
        headers: {
          'Referer': fetchReferer,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch iframe: ${response.statusText}` });
      }

      const html = await response.text();
      
      // Advanced Scraping: Look for the .m3u8 link inside the JS code
      // JW Player usually initializes with a setup block containing the 'file' property
      
      let m3u8Url = null;

      // Try to find the playlist variable first
      const playlistMatch = html.match(/var playlist = (\[.*?\]);/s);
      if (playlistMatch) {
        try {
          const playlist = JSON.parse(playlistMatch[1]);
          if (playlist && playlist.length > 0 && playlist[0].sources) {
            const hlsSource = playlist[0].sources.find((s: any) => s.type === 'hls' || s.file.toLowerCase().includes('.m3u8') || s.file.includes('/hlsplaylist/') || s.file.includes('/hls/'));
            if (hlsSource) {
              m3u8Url = hlsSource.file;
            } else if (playlist[0].sources.length > 0) {
              m3u8Url = playlist[0].sources[0].file;
            }
          }
        } catch (e) {
          console.error("Failed to parse playlist JSON:", e);
        }
      }

      // Fallback: Regex to find typical JW Player setup or source arrays
      if (!m3u8Url) {
        const m3u8Regex = /(["'])(https?:\/\/[^"']+(\.m3u8|\/hlsplaylist\/|\/hls\/)[^"']*)\1/i;
        const match = html.match(m3u8Regex);
        if (match && match[2]) {
          m3u8Url = match[2];
        }
      }

      if (m3u8Url) {
        console.log(`Found m3u8 URL: ${m3u8Url}`);
        return res.json({ m3u8Url });
      }

      // Fallback: Try to find it in a <source> tag if it's a standard HTML5 player
      const $ = cheerio.load(html);
      
      $('source').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.includes('.m3u8')) {
          m3u8Url = src;
        }
      });

      if (m3u8Url) {
        console.log(`Found m3u8 URL in <source>: ${m3u8Url}`);
        return res.json({ m3u8Url });
      }

      // If we can't find it, return an error
      console.log('Could not find .m3u8 link in the HTML content.');
      // For debugging, you might want to log parts of the HTML
      // console.log(html.substring(0, 1000)); 
      
      return res.status(404).json({ error: 'Could not extract .m3u8 link from the page.' });

    } catch (error: any) {
      console.error('Extraction error:', error);
      res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
  });

  // 2. Endpoint to proxy the .m3u8 playlist file
  app.get('/api/proxy-m3u8', async (req, res) => {
    const m3u8Url = req.query.url as string;
    const referer = req.query.referer as string;

    if (!m3u8Url) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      const targetUrl = new URL(m3u8Url);
      const fetchReferer = referer || targetUrl.origin;
      
      const response = await fetch(m3u8Url, {
        headers: {
          'Referer': fetchReferer,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch m3u8: ${response.statusText}`);
      }

      const m3u8Content = await response.text();
      const baseUrl = new URL(m3u8Url);
      const isMasterPlaylist = m3u8Content.includes('#EXT-X-STREAM-INF');
      
      // Handle both LF and CRLF line endings
      const lines = m3u8Content.split(/\r?\n/);
      const rewrittenLines = lines.map(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          if (trimmedLine.includes('URI="')) {
             return trimmedLine.replace(/URI="([^"]+)"/g, (match, uri) => {
                const absoluteUri = new URL(uri, baseUrl.href).href;
                const isPlaylist = absoluteUri.toLowerCase().includes('.m3u8') || absoluteUri.includes('/hlsplaylist/') || absoluteUri.includes('/hls/') || isMasterPlaylist;
                const endpoint = isPlaylist ? '/api/proxy-m3u8' : '/api/proxy-ts';
                return `URI="${endpoint}?url=${encodeURIComponent(absoluteUri)}&referer=${encodeURIComponent(fetchReferer)}"`;
             });
          }
          return line;
        }
        
        try {
          const absoluteUrl = new URL(trimmedLine, baseUrl.href).href;
          if (isMasterPlaylist || absoluteUrl.toLowerCase().includes('.m3u8') || absoluteUrl.includes('/hlsplaylist/') || absoluteUrl.includes('/hls/')) {
             return `/api/proxy-m3u8?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(fetchReferer)}`;
          } else {
             return `/api/proxy-ts?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(fetchReferer)}`;
          }
        } catch (e) {
          return line;
        }
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(rewrittenLines.join('\n'));

    } catch (error: any) {
      console.error('M3U8 Proxy error:', error);
      res.status(500).send(`Internal Server Error: ${error.message}`);
    }
  });

  // 3. Endpoint to proxy the actual video segments (.ts files)
  app.get('/api/proxy-ts', async (req, res) => {
    const tsUrl = req.query.url as string;
    const referer = req.query.referer as string;

    if (!tsUrl) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      const targetUrl = new URL(tsUrl);
      const fetchReferer = referer || targetUrl.origin;

      const response = await fetch(tsUrl, {
        headers: {
          'Referer': fetchReferer,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch segment: ${response.statusText}`);
      }

      // Forward content type or default to video/MP2T
      const contentType = response.headers.get('content-type') || 'video/MP2T';
      res.setHeader('Content-Type', contentType);
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (response.body) {
        // @ts-ignore
        const reader = response.body.getReader();
        res.on('close', () => {
            reader.cancel();
        });

        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                res.end();
                break;
              }
              if (!res.writableEnded) {
                res.write(value);
              } else {
                break;
              }
            }
          } catch (err) {
            console.error('Error streaming segment:', err);
            if (!res.writableEnded) res.end();
          }
        };
        pump();
      } else {
        res.status(500).send('No response body from segment server');
      }

    } catch (error: any) {
      console.error('TS Proxy error:', error);
      res.status(500).send(`Internal Server Error: ${error.message}`);
    }
  });

  // 4. Endpoint to proxy JSON requests (like dooplayer API)
  app.all('/api/fetch-json', async (req, res) => {
    const targetUrl = req.query.url as string;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      const fetchOptions: RequestInit = {
        method: req.method,
        headers: {
          'Referer': new URL(targetUrl).origin,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      };

      // Forward body for POST/PUT requests
      let finalTargetUrl = targetUrl;
      let urlObj;
      try {
        urlObj = new URL(targetUrl);
      } catch (e) {
        console.error("Invalid target URL:", targetUrl, e);
        return res.status(400).json({ error: 'Invalid URL parameter' });
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        // For admin-ajax.php, we usually need to send form data
        if (urlObj.searchParams.has('action')) {
          const formData = new URLSearchParams();
          urlObj.searchParams.forEach((value, key) => {
            formData.append(key, value);
          });
          fetchOptions.body = formData;
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          };
          
          // Remove query params from the URL since we're sending them in the body
          urlObj.search = '';
          finalTargetUrl = urlObj.toString();
          fetchOptions.method = 'POST';
        }
      }

      const response = await fetch(finalTargetUrl, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Proxy request failed: ${response.status} ${response.statusText}`, errorText);
        return res.status(response.status).json({ error: `Failed to fetch: ${response.statusText}`, details: errorText });
      }

      const text = await response.text();
      const contentType = response.headers.get('content-type');
      console.log(`Proxy response content-type: ${contentType}, length: ${text.length}`);

      if (!text) {
        console.error("Empty response from target");
        return res.status(500).json({ error: 'Empty response from target' });
      }

      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (e) {
        console.error("Failed to parse JSON response from target", text, e);
        return res.status(500).json({ error: 'Failed to parse JSON response from target', details: text, contentType });
      }
    } catch (error: any) {
      console.error('JSON Proxy error:', error);
      res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
  });

  // Original proxy endpoint (Improved for MP4/Direct videos with Range support)
  app.get('/api/proxy-video', async (req, res) => {
    const targetUrl = req.query.url as string;
    const referer = req.query.referer as string;

    if (!targetUrl) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      const targetUri = new URL(targetUrl);
      const fetchReferer = referer || targetUri.origin;
      
      const headers: Record<string, string> = {
        'Referer': fetchReferer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      // Forward Range header from the browser to the target server
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const response = await fetch(targetUrl, { headers });

      // Forward status code (especially 206 Partial Content)
      res.status(response.status);

      // Forward essential headers
      const headersToForward = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control'
      ];

      headersToForward.forEach(h => {
        const val = response.headers.get(h);
        if (val) res.setHeader(h, val);
      });
      
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (response.body) {
        // @ts-ignore
        const reader = response.body.getReader();
        res.on('close', () => reader.cancel());

        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                res.end();
                break;
              }
              if (!res.writableEnded) {
                res.write(value);
              } else {
                break;
              }
            }
          } catch (err) {
            console.error('Error streaming video:', err);
            if (!res.writableEnded) res.end();
          }
        };
        pump();
      } else {
        res.status(500).send('No response body from video server');
      }

    } catch (error: any) {
      console.error('Proxy error:', error);
      res.status(500).send(`Internal Server Error: ${error.message}`);
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      configFile: path.resolve(__dirname, 'vite.config.ts'),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
