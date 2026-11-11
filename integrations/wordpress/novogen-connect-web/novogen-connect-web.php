<?php
/**
 * Plugin Name: NOVOGEN CONNECT Catálogo
 * Description: Muestra en la web el catálogo comercial publicado en el CRM y deriva consultas a FLASH.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) { exit; }
add_shortcode('novogen_connect_catalogue', function () {
    $base = 'https://novogen-connect.vercel.app';
    $data = get_transient('novogen_connect_catalogue_v1');
    if (!is_array($data)) {
        $response = wp_remote_get($base . '/api/catalogue?slug=novogen', array('timeout' => 8, 'redirection' => 0));
        if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
            $data = json_decode(wp_remote_retrieve_body($response), true);
            if (is_array($data) && isset($data['items']) && is_array($data['items'])) {
                set_transient('novogen_connect_catalogue_v1', $data, 60);
            }
        }
    }
    if (!is_array($data) || !isset($data['items']) || !is_array($data['items'])) {
        return '<p>El catálogo no está disponible ahora. <a href="' . esc_url($base . '/connect/novogen/app') . '">Abrir CONNECT</a></p>';
    }
    $items = $data['items'];
    $render = function ($parent = null, $depth = 0) use (&$render, $items, $base) {
        if ($depth > 12) { return ''; }
        $html = '<ul class="novogen-connect-catalogue">';
        foreach ($items as $item) {
            if (($item['parent_id'] ?? null) !== $parent) { continue; }
            $title = esc_html($item['choice'] ?? $item['name']);
            $brand = esc_html($item['name']);
            $html .= '<li>';
            if (($item['type'] ?? '') === 'group') {
                $html .= '<details><summary>' . $title . '</summary>' . $render($item['id'], $depth + 1) . '</details>';
            } else {
                // Build the destination locally; never trust a remote arbitrary contact URL.
                $url = add_query_arg(array('service' => $item['id'], 'contact' => '1'), $base . '/connect/novogen/app');
                $html .= '<strong>' . $title . '</strong>';
                if ($title !== $brand) { $html .= '<small>' . $brand . '</small>'; }
                $html .= '<p>' . esc_html($item['description'] ?? '') . '</p><a class="novogen-connect-consult" href="' . esc_url($url) . '">Solicitar orientación</a>';
            }
            $html .= '</li>';
        }
        return $html . '</ul>';
    };
    return '<section aria-label="Servicios NOVOGEN"><style>.novogen-connect-catalogue{list-style:none;padding:0;margin:0}.novogen-connect-catalogue li{padding:16px 0;border-bottom:1px solid currentColor}.novogen-connect-catalogue ul{padding-left:16px}.novogen-connect-catalogue summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600}.novogen-connect-catalogue small{display:block}.novogen-connect-consult{display:inline-flex;min-height:44px;align-items:center;padding:8px 14px;box-sizing:border-box}.novogen-connect-catalogue p{overflow-wrap:anywhere}</style>' . $render() . '<p><a href="' . esc_url($base . '/connect/novogen/app') . '">Abrir CONNECT</a></p></section>';
});
