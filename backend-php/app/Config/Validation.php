<?php

namespace Config;

use App\Validation\LedgerlyRules;
use CodeIgniter\Config\BaseConfig;
use CodeIgniter\Validation\StrictRules\CreditCardRules;
use CodeIgniter\Validation\StrictRules\FileRules;
use CodeIgniter\Validation\StrictRules\FormatRules;
use CodeIgniter\Validation\StrictRules\Rules;

class Validation extends BaseConfig
{
    // --------------------------------------------------------------------
    // Setup
    // --------------------------------------------------------------------

    /**
     * Stores the classes that contain the
     * rules that are available.
     *
     * @var list<string>
     */
    public array $ruleSets = [
        Rules::class,
        FormatRules::class,
        FileRules::class,
        CreditCardRules::class,
        LedgerlyRules::class,
    ];

    /**
     * Specifies the views that are used to display the
     * errors.
     *
     * @var array<string, string>
     */
    public array $templates = [
        'list'   => 'CodeIgniter\Validation\Views\list',
        'single' => 'CodeIgniter\Validation\Views\single',
    ];

    // --------------------------------------------------------------------
    // Rules
    // --------------------------------------------------------------------

    // --------------------------------------------------------------------
    // Auth (same rules and messages as backend/src/modules/auth/auth.validation.js)
    // --------------------------------------------------------------------
    // Values are trimmed / lowercased by the controller before these run.
    // "string" comes first so a missing or non-text value gets the "is required" message.

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $login = [
        'login' => [
            'rules'  => ['string', 'required'],
            'errors' => [
                'string'   => 'Username or email is required.',
                'required' => 'Username or email is required.',
            ],
        ],
        'password' => [
            'rules'  => ['string', 'min_length[1]'],
            'errors' => [
                'string'     => 'Password is required.',
                'min_length' => 'Password is required.',
            ],
        ],
    ];

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $forgotPassword = [
        'email' => self::EMAIL,
    ];

    /**
     * The logged-in user's own details (Edit profile).
     *
     * @var array<string, array<string, mixed>>
     */
    public array $profile = self::PROFILE;

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $signup = self::PROFILE + [
        'company' => [
            'rules'  => ['string', 'required', 'max_length[150]'],
            'errors' => [
                'string'     => 'Company name is required.',
                'required'   => 'Company name is required.',
                'max_length' => 'Company name is too long.',
            ],
        ],
        'password' => [
            'rules'  => ['string', 'min_length[8]', 'max_length[72]'],
            'errors' => [
                'string'     => 'Password is required.',
                'min_length' => 'Password must be at least 8 characters.',
                'max_length' => 'Password is too long.',
            ],
        ],
    ];

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $passwordChange = [
        'currentPassword' => [
            'rules'  => ['string', 'min_length[1]'],
            'errors' => [
                'string'     => 'Current password is required.',
                'min_length' => 'Current password is required.',
            ],
        ],
        // bcrypt only uses the first 72 bytes.
        'newPassword' => [
            'rules'  => ['string', 'min_length[8]', 'max_length[72]'],
            'errors' => [
                'string'     => 'New password is required.',
                'min_length' => 'New password must be at least 8 characters.',
                'max_length' => 'New password is too long.',
            ],
        ],
    ];

    private const EMAIL = [
        'rules'  => ['string', 'required', 'max_length[254]', 'valid_email'],
        'errors' => [
            'string'      => 'Email is required.',
            'required'    => 'Email is required.',
            'max_length'  => 'Email is too long.',
            'valid_email' => 'Enter a valid email address.',
        ],
    ];

    private const PROFILE = [
        'name' => [
            'rules'  => ['string', 'required', 'max_length[100]'],
            'errors' => [
                'string'     => 'Name is required.',
                'required'   => 'Name is required.',
                'max_length' => 'Name is too long.',
            ],
        ],
        'username' => [
            'rules'  => ['string', 'regex_match[/^[a-z0-9._]{3,30}$/]'],
            'errors' => [
                'string'      => 'Username is required.',
                'regex_match' => 'Use 3–30 letters, numbers, dots or underscores.',
            ],
        ],
        'email' => self::EMAIL,
        // Spaces and dashes are removed by the controller first.
        'phone' => [
            'rules'  => ['string', 'regex_match[/^\+?\d{10,15}$/]'],
            'errors' => [
                'string'      => 'Phone number is required.',
                'regex_match' => 'Enter a valid phone number (10–15 digits).',
            ],
        ],
    ];

    // --------------------------------------------------------------------
    // Company, clients, items, invoices (backend/src/lib/validation.js and the module schemas)
    // --------------------------------------------------------------------
    // Built in the constructor from the helpers below. The controllers clean values first
    // (trim, '' → null, number coercion, defaults), see BaseController::validated().

    /**
     * The logged-in user's own business ("seller") details.
     *
     * @var array<string, array<string, mixed>>
     */
    public array $seller = [];

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $signature = [];

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $client = [];

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $receipt = [];

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $item = [];

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $invoice = [];

    /**
     * @var array<string, array<string, mixed>>
     */
    public array $invoiceStatus = [];

    // Max length of the stored data URL (~180 KB image); the frontend resizes signatures well below this.
    public const MAX_SIGNATURE_LENGTH = 250000;

    public const INVOICE_STATUSES  = ['draft', 'unpaid', 'paid'];
    public const INVOICE_TEMPLATES = ['classic', 'modern', 'minimal'];

    public function __construct()
    {
        parent::__construct();

        $this->seller = [
            'name'      => self::requiredText('Business name', 150),
            'address'   => self::optionalText('Address', 1000),
            'stateCode' => self::stateCode(true),
            'gstin'     => self::GSTIN,
            'phone'     => self::OPTIONAL_PHONE,
            'email'     => self::OPTIONAL_EMAIL,
            'bankName'  => self::optionalText('Bank name', 100),
            'accountNo' => self::optionalText('Account number', 34),
            'ifsc'      => self::optionalText('IFSC code', 11),
            'terms'     => self::optionalText('Terms', 4000),
        ];

        $this->signature = [
            'signature' => [
                'rules'  => ['string', 'max_length[' . self::MAX_SIGNATURE_LENGTH . ']', 'regex_match[/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/]+=*$/]'],
                'errors' => [
                    'string'      => 'Choose a signature image.',
                    'max_length'  => 'Signature image is too large.',
                    'regex_match' => 'Upload a PNG, JPG or WebP image.',
                ],
            ],
        ];

        // GSTIN must start with the state code: checked in the Clients controller.
        $this->client = [
            'name'      => self::requiredText('Customer name', 150),
            'address'   => self::optionalText('Address', 1000),
            'stateCode' => self::stateCode(false),
            'gstin'     => self::GSTIN,
            'phone'     => self::OPTIONAL_PHONE,
            'email'     => self::OPTIONAL_EMAIL,
            // Owed before using the app: positive = due (Dr), negative = advance (Cr).
            'openingBalance' => [
                'rules'  => ['permit_empty', 'js_number', 'greater_than_equal_to[-9999999999]', 'less_than_equal_to[9999999999]'],
                'errors' => [
                    'js_number'             => 'Opening balance must be a number.',
                    'greater_than_equal_to' => 'Opening balance is too large.',
                    'less_than_equal_to'    => 'Opening balance is too large.',
                ],
            ],
        ];

        $this->receipt = [
            'clientId' => [
                'rules'  => ['js_integer', 'greater_than[0]'],
                'errors' => ['js_integer' => 'Choose a customer.', 'greater_than' => 'Choose a customer.'],
            ],
            'receiptDate' => [
                'rules'  => ['string', 'iso_date'],
                'errors' => ['string' => 'Receipt date is required.', 'iso_date' => 'Receipt date must be a valid date.'],
            ],
            'mode' => [
                'rules'  => ['in_list[cash,bank]'],
                'errors' => ['in_list' => 'Choose cash or bank.'],
            ],
            'amount' => [
                'rules'  => ['js_number', 'greater_than[0]', 'less_than_equal_to[9999999999]'],
                'errors' => [
                    'js_number'          => 'Amount must be a number.',
                    'greater_than'       => 'Amount must be more than 0.',
                    'less_than_equal_to' => 'Amount is too large.',
                ],
            ],
            'reference' => self::optionalText('Narration', 100),
        ];

        $this->item = [
            'name'      => self::requiredText('Product/service name', 200),
            'hsnSac'    => self::optionalText('HSN/SAC', 20),
            'unit'      => self::UNIT,
            'unitPrice' => self::money('Rate'),
            'gstRate'   => self::GST_RATE,
        ];

        // Due date not before the invoice date: checked in the Invoices controller.
        $this->invoice = [
            'clientId' => [
                'rules'  => ['js_integer', 'greater_than[0]'],
                'errors' => ['js_integer' => 'Choose a customer.', 'greater_than' => 'Choose a customer.'],
            ],
            'invoiceNumber' => self::requiredText('Invoice number', 40),
            'invoiceDate'   => [
                'rules'  => ['string', 'iso_date'],
                'errors' => ['string' => 'Invoice date is required.', 'iso_date' => 'Invoice date must be a valid date.'],
            ],
            'dueDate' => [
                'rules'  => ['iso_date[nullable]'],
                'errors' => ['iso_date' => 'Due date must be a valid date.'],
            ],
            'placeOfSupplyCode' => self::stateCode(true),
            'reverseCharge'     => ['rules' => ['boolean']],
            'template' => self::oneOf(self::INVOICE_TEMPLATES),
            'status'   => self::oneOf(self::INVOICE_STATUSES),
            'lines'    => [
                'rules'  => ['list_size[1,200]'],
                'errors' => ['list_size' => 'Add at least one product/service.'],
            ],
            'lines.*.itemId' => [
                'rules'  => ['permit_empty', 'js_number', 'js_integer', 'greater_than[0]'],
                'errors' => [
                    'js_number'    => 'Invalid input: expected number, received NaN',
                    'js_integer'   => 'Invalid input: expected int, received number',
                    'greater_than' => 'Too small: expected number to be >0',
                ],
            ],
            'lines.*.description' => self::requiredText('Product/service', 200),
            'lines.*.narration'   => self::optionalText('Narration', 500),
            'lines.*.hsnSac'      => self::optionalText('HSN/SAC', 20),
            'lines.*.quantity'    => [
                'rules'  => ['js_number', 'greater_than[0]', 'less_than_equal_to[1000000000]'],
                'errors' => [
                    'js_number'          => 'Quantity must be a number.',
                    'greater_than'       => 'Quantity must be more than 0.',
                    'less_than_equal_to' => 'Quantity is too large.',
                ],
            ],
            'lines.*.unit'      => self::UNIT,
            'lines.*.unitPrice' => self::money('Rate'),
            'lines.*.gstRate'   => self::GST_RATE,
        ];

        $this->invoiceStatus = [
            'status' => [
                'rules'  => ['in_list[' . implode(',', self::INVOICE_STATUSES) . ']'],
                'errors' => ['in_list' => 'Choose a valid status.'],
            ],
        ];
    }

    // Optional fields are cleaned to null when empty, so permit_empty skips their other rules.

    private const GSTIN = [
        'rules'  => ['gstin'],
        'errors' => ['gstin' => 'Enter a valid 15-character GSTIN.'],
    ];

    private const OPTIONAL_PHONE = [
        'rules'  => ['indian_mobile'],
        'errors' => ['indian_mobile' => 'Enter a valid 10-digit mobile number.'],
    ];

    private const OPTIONAL_EMAIL = [
        'rules'  => ['permit_empty', 'max_length[254]', 'optional_email'],
        'errors' => ['max_length' => 'Email is too long.', 'optional_email' => 'Enter a valid email address.'],
    ];

    private const UNIT = [
        'rules'  => ['unit'],
        'errors' => ['unit' => 'Invalid input'],
    ];

    private const GST_RATE = [
        'rules'  => ['js_number', 'greater_than_equal_to[0]', 'less_than_equal_to[100]'],
        'errors' => [
            'js_number'             => 'GST % must be a number.',
            'greater_than_equal_to' => "GST % can't be negative.",
            'less_than_equal_to'    => 'GST % must be 100 or less.',
        ],
    ];

    /**
     * @return array<string, mixed>
     */
    private static function requiredText(string $label, int $max): array
    {
        return [
            'rules'  => ['string', 'required', "max_length[{$max}]"],
            'errors' => [
                'string'     => "{$label} is required.",
                'required'   => "{$label} is required.",
                'max_length' => "{$label} is too long.",
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function optionalText(string $label, int $max): array
    {
        return [
            'rules'  => ['permit_empty', 'text', "max_length[{$max}]"],
            'errors' => ['max_length' => "{$label} is too long."],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function stateCode(bool $nullable): array
    {
        return [
            'rules'  => [$nullable ? 'state_code[nullable]' : 'state_code'],
            'errors' => ['state_code' => 'Choose a valid state.'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function money(string $label): array
    {
        return [
            'rules'  => ['js_number', 'greater_than_equal_to[0]', 'less_than_equal_to[9999999999]'],
            'errors' => [
                'js_number'             => "{$label} must be a number.",
                'greater_than_equal_to' => "{$label} can't be negative.",
                'less_than_equal_to'    => "{$label} is too large.",
            ],
        ];
    }

    /**
     * @param list<string> $options
     *
     * @return array<string, mixed>
     */
    private static function oneOf(array $options): array
    {
        return [
            'rules'  => ['in_list[' . implode(',', $options) . ']'],
            'errors' => ['in_list' => 'Invalid option: expected one of "' . implode('"|"', $options) . '"'],
        ];
    }
}
