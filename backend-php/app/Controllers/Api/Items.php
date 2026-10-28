<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\ItemModel;

/**
 * /api/items — port of modules/items/items.js.
 */
class Items extends BaseController
{
    private const CLEANERS = [
        'name'      => ['trim'],
        'hsnSac'    => ['trim', 'empty_to_null'],
        'unit'      => ['empty_to_null'],
        'unitPrice' => ['number'],
        'gstRate'   => ['number'],
    ];

    private ItemModel $items;

    public function __construct()
    {
        $this->items = model(ItemModel::class);
    }

    public function index()
    {
        return $this->json($this->items->listFor($this->companyId()));
    }

    public function create()
    {
        $id = $this->items->insert([...ItemModel::toRow($this->validated('item', self::CLEANERS)), 'company_id' => $this->companyId()]);

        return $this->json(ItemModel::toDto($this->items->findOwned($this->companyId(), (int) $id)), 201);
    }

    public function update(string $id)
    {
        $row = $this->items->findOwned($this->companyId(), $this->id($id));
        $this->items->update($row['id'], ItemModel::toRow($this->validated('item', self::CLEANERS)));

        return $this->json(ItemModel::toDto($this->items->findOwned($this->companyId(), (int) $row['id'])));
    }

    public function delete(string $id)
    {
        $row = $this->items->findOwned($this->companyId(), $this->id($id));
        $this->items->delete($row['id']);

        return $this->noContent();
    }
}
