<?php

namespace App\Libraries;

use RuntimeException;

/**
 * Sends a plain-text email. Without SMTP_HOST (development), writes it to the log
 * (writable/logs) instead.
 */
class Mailer
{
    public static function send(string $to, string $subject, string $text): void
    {
        $config = config('Email');
        if ($config->SMTPHost === '') {
            log_message('info', "[mail] To: {$to}\n[mail] Subject: {$subject}\n{$text}");

            return;
        }

        $email = service('email', $config, false);
        $email->setFrom($config->fromEmail, $config->fromName);
        $email->setTo($to);
        $email->setSubject($subject);
        $email->setMessage($text);

        if (! $email->send(false)) {
            throw new RuntimeException('Email failed: ' . $email->printDebugger(['headers']));
        }
    }
}
