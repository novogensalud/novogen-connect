<?php
/**
 * Plugin Name: NOVOGEN CONNECT — Cookies y métricas
 * Description: Conecta la categoría Estadísticas de Complianz con las métricas web de CONNECT, sin un segundo aviso.
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: complianz-gdpr
 * Author: NOVOGEN
 * License: GPL-2.0-or-later
 */
if (!defined('ABSPATH')) { exit; }

add_action('admin_menu', function () {
    add_options_page('CONNECT · Cookies', 'CONNECT · Cookies', 'manage_options', 'novogen-connect-cookies', 'novogen_connect_cookies_page');
});
add_action('admin_init', function () {
    register_setting('novogen_connect_cookies', 'novogen_connect_metrics_origin', array(
        'type' => 'string', 'default' => '',
        'sanitize_callback' => function ($value) {
            $url = esc_url_raw(trim($value), array('https'));
            $parts = wp_parse_url($url);
            if (!$url || empty($parts['host']) || ($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment']) || !empty(trim($parts['path'] ?? '', '/'))) {
                add_settings_error('novogen_connect_metrics_origin', 'invalid_origin', 'Ingresa solo el origen HTTPS público de CONNECT, sin rutas ni credenciales.');
                return get_option('novogen_connect_metrics_origin', '');
            }
            return untrailingslashit($url);
        }
    ));
});
function novogen_connect_cookies_page() {
    if (!current_user_can('manage_options')) { return; }
    ?>
    <div class="wrap"><h1>CONNECT · Cookies y métricas</h1>
    <p>Configura Complianz con consentimiento previo (opt-in) y Estadísticas desactivadas hasta que la persona acepte. No habilites estadísticas sin consentimiento.</p>
    <p>Este complemento no muestra otro banner ni modifica las preferencias de cookies. No funciona con un Preview protegido por inicio de sesión de Vercel.</p>
    <form method="post" action="options.php">
    <?php settings_fields('novogen_connect_cookies'); settings_errors(); ?>
    <label for="novogen-connect-origin">Origen público de CONNECT</label><br>
    <input class="regular-text" id="novogen-connect-origin" type="url" name="novogen_connect_metrics_origin" value="<?php echo esc_attr(get_option('novogen_connect_metrics_origin', '')); ?>" placeholder="https://connect.tu-dominio.cl">
    <?php submit_button(); ?>
    </form><p>Sin origen configurado o sin aceptación de Estadísticas no se envían métricas. Los eventos quedan identificados como Sitio web en el dashboard.</p></div>
    <?php
}
add_action('wp_enqueue_scripts', function () {
    $origin = get_option('novogen_connect_metrics_origin', '');
    if (!$origin || is_admin()) { return; }
    wp_enqueue_script('novogen-connect-cookies', $origin . '/web-tracker.js', array(), '0.1.0', true);
});
add_filter('script_loader_tag', function ($tag, $handle) {
    if ($handle !== 'novogen-connect-cookies') { return $tag; }
    return str_replace('<script ', '<script data-slug="novogen" data-consent="complianz" ', $tag);
}, 10, 2);
