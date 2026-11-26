<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Browser security headers on every response (set from PHP so they work on any web server).
 *
 * On HTML pages (the Angular app) it also sends a Content-Security-Policy: scripts only from this site,
 * plus the app's own inline <script> blocks allowed by hash (worked out from the page itself, so a new
 * frontend build never needs a config change). This stops injected scripts from running or loading
 * code from other sites.
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
            $response->setHeader('Content-Security-Policy', self::contentSecurityPolicy((string) $response->getBody()));
        }
    }

    private static function contentSecurityPolicy(string $html): string
    {
        $scriptSources = ["'self'"];
        if (preg_match_all('#<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>#is', $html, $matches)) {
            foreach ($matches[1] as $inline) {
                if (trim($inline) !== '') {
                    $scriptSources[] = "'sha256-" . base64_encode(hash('sha256', $inline, true)) . "'";
                }
            }
        }

        return implode('; ', [
            "default-src 'self'",
            'script-src ' . implode(' ', array_unique($scriptSources)),
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
}
