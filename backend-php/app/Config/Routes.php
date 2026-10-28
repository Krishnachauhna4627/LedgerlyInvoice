<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 *
 * Same URLs as the Node backend (backend/src/app.js), so the frontend works unchanged.
 */
$routes->group('api', ['namespace' => 'App\Controllers\Api'], static function (RouteCollection $routes) {
    // CORS preflight for every API route (answered by the cors filter, see Config\Filters::$filters).
    $routes->options('(:any)', static function () {});

    $routes->get('health', 'Health::index');

    $routes->group('auth', static function (RouteCollection $routes) {
        $routes->post('signup', 'Auth::signup');
        $routes->post('login', 'Auth::login');
        $routes->post('forgot-password', 'Auth::forgotPassword');
        $routes->get('me', 'Auth::me', ['filter' => 'auth']);
        $routes->put('me', 'Auth::updateMe', ['filter' => 'auth']);
        $routes->put('me/password', 'Auth::changePassword', ['filter' => 'auth']);
    });

    $routes->group('company', ['filter' => 'auth'], static function (RouteCollection $routes) {
        $routes->get('/', 'Company::show');
        $routes->put('/', 'Company::update');
        $routes->put('signature', 'Company::saveSignature');
        $routes->delete('signature', 'Company::deleteSignature');
    });

    $routes->group('clients', ['filter' => 'auth'], static function (RouteCollection $routes) {
        $routes->get('/', 'Clients::index');
        $routes->get('(:segment)', 'Clients::show/$1');
        $routes->post('/', 'Clients::create');
        $routes->put('(:segment)', 'Clients::update/$1');
        $routes->delete('(:segment)', 'Clients::delete/$1');
    });

    $routes->group('items', ['filter' => 'auth'], static function (RouteCollection $routes) {
        $routes->get('/', 'Items::index');
        $routes->post('/', 'Items::create');
        $routes->put('(:segment)', 'Items::update/$1');
        $routes->delete('(:segment)', 'Items::delete/$1');
    });

    $routes->group('invoices', ['filter' => 'auth'], static function (RouteCollection $routes) {
        $routes->get('/', 'Invoices::index');
        $routes->get('count', 'Invoices::count');
        $routes->get('next-number', 'Invoices::nextNumber');
        $routes->get('(:segment)', 'Invoices::show/$1');
        $routes->post('/', 'Invoices::create');
        $routes->put('(:segment)', 'Invoices::update/$1');
        $routes->patch('(:segment)/status', 'Invoices::setStatus/$1');
        $routes->delete('(:segment)', 'Invoices::delete/$1');
    });

    $routes->group('reports', ['filter' => 'auth'], static function (RouteCollection $routes) {
        $routes->get('dashboard', 'Reports::dashboard');
        $routes->get('sales', 'Reports::sales');
        $routes->get('sales/export', 'Reports::salesExport');
    });

    $routes->group('admin', ['filter' => ['auth', 'admin']], static function (RouteCollection $routes) {
        $routes->get('users', 'Admin::users');
        $routes->get('users/(:segment)', 'Admin::user/$1');
        $routes->get('invoices/(:segment)', 'Admin::invoice/$1');
    });
});
