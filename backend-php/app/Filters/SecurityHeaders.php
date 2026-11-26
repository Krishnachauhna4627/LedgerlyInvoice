<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Browser security headers on every response (set from PHP so they work on any web server).
 *
 * On HTML pages (the Angular app) it also sends a Content-Security-Policy: scripts only from this site,
 * plus the inline <script> blocks of the built public/angular/index.html allowed by hash (read from that
 * file, never from the response, so nothing a page outputs can allow itself; a new frontend build needs
 * no config change). This stops injected scripts from running or loading code from other sites.
 */
class SecurityHeaders implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        self::apply($request, $response);
    }

    public static function apply(RequestInterface $request, ResponseInterface $response): void
    {
        // No other site may show these pages in a frame (stops clickjacking).
        $response->setHeader('X-Frame-Options', 'DENY');
        $response->setHeader('X-Content-Type-Options', 'nosniff');
        $response->setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        // Only over HTTPS: tells the browser to always use HTTPS for this site from now on.
        if (method_exists($request, 'isSecure') && $request->isSecure()) {
            $response->setHeader('Strict-Transport-Security', 'max-age=31536000');
        }

        if (str_contains($response->getHeaderLine('Content-Type'), 'text/html')) {
            $response->setHeader('Content-Security-Policy', self::contentSecurityPolicy());
        }
    }

    private static function contentSecurityPolicy(): string
    {
        return implode('; ', [
            "default-src 'self'",
            'script-src ' . implode(' ', ["'self'", ...self::appInlineScriptHashes()]),
            // Angular sets inline styles; Inter comes from Google Fonts.
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            // Logo / signature images are data: URLs; PDFs made in the browser are blob: URLs.
            "img-src 'self' data: blob:",
            "connect-src 'self'",
            "worker-src 'self' blob:",
            "frame-src 'self' blob:",
            "object-src 'self' blob:",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ]);
    }

    /**
     * Hashes of the inline <script> blocks in the built Angular index.html (the trusted file on disk).
     *
     * @return list<string>
     */
    private static function appInlineScriptHashes(): array
    {
        static $cache = [];
        $file  = FCPATH . 'angular/index.html';
        $mtime = @filemtime($file);
        if ($mtime === false) {
            return [];
        }
        if (! isset($cache[$mtime])) {
            $hashes = [];
            if (preg_match_all('#<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>#is', (string) file_get_contents($file), $matches)) {
                foreach ($matches[1] as $inline) {
                    if (trim($inline) !== '') {
                        $hashes[] = "'sha256-" . base64_encode(hash('sha256', $inline, true)) . "'";
                    }
                }
            }
            $cache = [$mtime => array_values(array_unique($hashes))];
        }

        return $cache[$mtime];
    }
}
