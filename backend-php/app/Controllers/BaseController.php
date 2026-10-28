<?php

namespace App\Controllers;

use App\Exceptions\HttpError;
use App\Validation\LedgerlyRules;
use CodeIgniter\Controller;
use CodeIgniter\HTTP\Exceptions\HTTPException;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Psr\Log\LoggerInterface;

/**
 * Shared helpers for the API controllers: JSON body, validation (Config\Validation rule groups),
 * id parameters and responses.
 *
 * For security, be sure to declare any new methods as protected or private.
 */
abstract class BaseController extends Controller
{
    /**
     * @return void
     */
    public function initController(RequestInterface $request, ResponseInterface $response, LoggerInterface $logger)
    {
        // Caution: Do not edit this line.
        parent::initController($request, $response, $logger);

        // TIMESTAMP columns come back in UTC, so iso_timestamp() can turn them into the ISO strings
        // the Node API returns, whatever time zone the MySQL server uses.
        db_connect()->query("SET time_zone = '+00:00'");
    }

    /**
     * The logged-in user's company (set by AuthFilter). Every query on business data is scoped by it.
     */
    protected function companyId(): int
    {
        return service('currentUser')->companyId;
    }

    /**
     * A positive whole-number URL id; anything else answers 404 like the Node idParam.
     */
    protected function id(string $value): int
    {
        if (preg_match('/^\d+$/', $value) !== 1 || (int) $value < 1) {
            throw new HttpError(404, 'Not found.');
        }

        return (int) $value;
    }

    /**
     * @param array<mixed>|null $data
     */
    protected function json($data, int $status = 200): ResponseInterface
    {
        return $this->response->setStatusCode($status)->setJSON($data);
    }

    protected function noContent(): ResponseInterface
    {
        return $this->response->setStatusCode(204);
    }

    /**
     * The JSON request body as an array ([] when empty or not an object).
     *
     * @return array<string, mixed>
     */
    protected function body(): array
    {
        try {
            $body = $this->request->getJSON(true);
        } catch (HTTPException) {
            throw new HttpError(400, 'Request body must be valid JSON.');
        }

        return is_array($body) ? $body : [];
    }

    /**
     * Cleans the body (see clean()), validates it against a rule group in Config\Validation and
     * returns only the validated fields. On failure responds 400 with { message, errors: { field: message } }.
     *
     * $cleaners maps a field to its cleaning steps; a key like 'lines.*' maps to the cleaners for each
     * entry of that list (every entry must be an object). Optional fields left empty come back as null.
     *
     * @param array<string, list<string>|array<string, list<string>>> $cleaners
     * @param callable(array<string, mixed>, array<string, string>): array<string, string>|null $check
     *                                                                                                 cross-field rules, given the cleaned data and the errors so far; returns extra errors
     *
     * @return array<string, mixed>
     */
    protected function validated(string $group, array $cleaners = [], ?callable $check = null): array
    {
        $data   = $this->body();
        $errors = [];

        foreach ($cleaners as $field => $steps) {
            if (str_ends_with($field, '.*')) {
                $list = substr($field, 0, -2);
                if (! isset($data[$list]) || ! is_array($data[$list]) || ! array_is_list($data[$list])) {
                    continue;
                }

                foreach ($data[$list] as $index => $entry) {
                    if (! is_array($entry) || ($entry !== [] && array_is_list($entry))) {
                        $errors["{$list}.{$index}"] = 'Invalid input: expected object, received ' . LedgerlyRules::jsType($entry);

                        continue;
                    }
                    $data[$list][$index] = self::cleanFields($entry, $steps);
                }

                continue;
            }
            $data = self::cleanFields($data, [$field => $steps]);
        }

        if (! $this->validateData($data, $group)) {
            // Wildcard rules report 'lines.*.field' when the list has no entries; the list's own rule covers that.
            $errors += array_filter($this->validator->getErrors(), static fn (string $field): bool => ! str_contains($field, '*'), ARRAY_FILTER_USE_KEY);
        }
        if ($check !== null) {
            $errors += $check($data, $errors);
        }
        if ($errors !== []) {
            throw new HttpError(400, 'Please fix the highlighted fields.', $errors);
        }

        return self::onlyRuleFields($data, array_keys(config('Validation')->{$group}));
    }

    /**
     * Keeps only the fields that have rules (like zod dropping unknown keys). Unlike the validator's
     * getValidated(), null values are kept.
     *
     * @param array<string, mixed> $data
     * @param list<string>         $ruleFields e.g. ['name', 'lines', 'lines.*.description']
     *
     * @return array<string, mixed>
     */
    private static function onlyRuleFields(array $data, array $ruleFields): array
    {
        $result = [];
        $nested = [];
        foreach ($ruleFields as $field) {
            if (preg_match('/^([^.]+)\.\*\.([^.]+)$/', $field, $match)) {
                $nested[$match[1]][] = $match[2];
            } else {
                $result[$field] = $data[$field] ?? null;
            }
        }
        foreach ($nested as $list => $fields) {
            $result[$list] = array_map(
                static fn (array $entry): array => array_intersect_key($entry, array_flip($fields)),
                $result[$list],
            );
        }

        return $result;
    }

    /**
     * Applies cleaning steps to fields of $data. Missing fields are set too (to null, or what the steps
     * give, e.g. a default), so wildcard rules like 'lines.*.description' still see them.
     *
     * @param array<string, mixed>        $data
     * @param array<string, list<string>> $fieldSteps
     *
     * @return array<string, mixed>
     */
    private static function cleanFields(array $data, array $fieldSteps): array
    {
        foreach ($fieldSteps as $field => $steps) {
            $exists = array_key_exists($field, $data);
            $value  = $data[$field] ?? null;
            foreach ($steps as $step) {
                $value = self::clean($value, $exists, $step);
            }
            $data[$field] = $value;
        }

        return $data;
    }

    /**
     * One cleaning step (the zod transforms/coercions of the Node schemas):
     * trim, lower, upper, no_spaces_dashes, indian_phone, empty_to_null,
     * number (JavaScript Number() coercion), nullable_number, default:<json value>.
     *
     * @param mixed $value
     *
     * @return mixed
     */
    private static function clean($value, bool $exists, string $step)
    {
        if (str_starts_with($step, 'default:')) {
            return $exists ? $value : json_decode(substr($step, 8), true);
        }

        return match ($step) {
            'trim'             => is_string($value) ? trim($value) : $value,
            'lower'            => is_string($value) ? mb_strtolower($value) : $value,
            'upper'            => is_string($value) ? mb_strtoupper($value) : $value,
            'no_spaces_dashes' => is_string($value) ? preg_replace('/[\s-]/u', '', $value) : $value,
            // Spaces/dashes and a +91 / 0 prefix are ignored.
            'indian_phone' => is_string($value)
                ? preg_replace('/^(?:\+91|0)(?=\d{10}$)/', '', preg_replace('/[\s-]/u', '', $value))
                : $value,
            'empty_to_null'   => $value === '' ? null : $value,
            'number'          => $exists ? self::jsNumber($value) : NAN,
            'nullable_number' => $value === null ? null : self::jsNumber($value),
        };
    }

    /**
     * JavaScript's Number(value): null/''/false → 0, true → 1, numeric strings → number, else NaN.
     *
     * @param mixed $value
     */
    private static function jsNumber($value): float|int
    {
        if (is_int($value) || is_float($value)) {
            return $value;
        }
        if ($value === null || $value === false) {
            return 0;
        }
        if ($value === true) {
            return 1;
        }
        if (is_string($value)) {
            $value = trim($value);
            if ($value === '') {
                return 0;
            }
            if (is_numeric($value)) {
                return $value + 0;
            }
        }

        return NAN;
    }
}
