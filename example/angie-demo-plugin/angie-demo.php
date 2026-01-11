<?php
/**
* Plugin Name: Angie Demo - Local AI Edition
* Description: A standalone, privacy-focused version of Angie that runs MCP tools locally using Google Gemini.
* Version: 2.0.5
* Author: Elementor.com
* Plugin URI: https://elementor.com/
*/

if ( ! defined( 'ABSPATH' ) ) {
exit;
}

// Load Features
require_once plugin_dir_path( __FILE__ ) . 'features/seo-analyzer.php';
require_once plugin_dir_path( __FILE__ ) . 'features/post-type-manager.php';
require_once plugin_dir_path( __FILE__ ) . 'features/security-checker.php';
require_once plugin_dir_path( __FILE__ ) . 'features/user-profile-settings.php';
require_once plugin_dir_path( __FILE__ ) . 'features/api-manager.php';
require_once plugin_dir_path( __FILE__ ) . 'features/analytics-logger.php';

class Angie_Demo_Plugin {

const VERSION = '2.0.5';
const REST_NAMESPACE = 'angie/v1';

const POST_TYPES_OPTION = 'angie_demo_post_types';

private $seo_analyzer;
private $post_type_manager;
private $security_checker;
private $user_profile_settings;
private $api_manager;

public function __construct() {
$this->load_features();
add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_scripts' ] );
add_action( 'admin_footer', [ $this, 'render_app_root' ] );
}

private function load_features() {
$this->seo_analyzer      = new Angie_Demo_SEO_Analyzer();
$this->post_type_manager = new Angie_Demo_Post_Type_Manager();
$this->security_checker  = new Angie_Demo_Security_Checker();
$this->user_profile_settings = new Angie\Features\UserProfileSettings();
$this->api_manager       = new Angie\Features\ApiManager();
}

public function render_app_root() {
if ( current_user_can( 'manage_options' ) ) {
            // Unique container for React to mount into
echo '<div id="angie-local-root"></div>';
}
}

public function enqueue_scripts() {
if ( ! current_user_can( 'manage_options' ) ) {
return;
}

$script_url = plugin_dir_url( __FILE__ ) . 'out/angie-demo.js';

        // FIX: Ensure we look for the correct CSS file name (usually matches entry or generic style.css)
        // We try 'angie-demo.css' first (Vite default for named entry), then fallback.
        $style_url = file_exists( plugin_dir_path( __FILE__ ) . 'out/angie-demo.css' )
            ? plugin_dir_url( __FILE__ ) . 'out/angie-demo.css'
            : plugin_dir_url( __FILE__ ) . 'out/style.css';

$ver = file_exists( plugin_dir_path( __FILE__ ) . 'out/angie-demo.js' )
? filemtime( plugin_dir_path( __FILE__ ) . 'out/angie-demo.js' )
: self::VERSION;

wp_enqueue_script(
'angie-demo-local',
$script_url,
[ 'wp-element', 'wp-api-fetch', 'wp-i18n' ],
$ver,
true
);

        // Enqueue CSS
        if ( file_exists( plugin_dir_path( __FILE__ ) . 'out/angie-demo.css' ) || file_exists( plugin_dir_path( __FILE__ ) . 'out/style.css' ) ) {
            wp_enqueue_style(
                'angie-demo-style',
                $style_url,
                [],
                $ver
            );
        }

        // FIX: Remove trailing slash from rest_url() to prevent double-slash issues (//)
        // which can cause 301 redirects that strip POST data.
wp_localize_script( 'angie-demo-local', 'angieConfig', [
'apiBaseUrl' => untrailingslashit( rest_url() ),
'nonce'      => wp_create_nonce( 'wp_rest' ),
] );
}

public function register_rest_routes() {
$this->seo_analyzer->register_rest_routes();
$this->post_type_manager->register_rest_routes();
$this->security_checker->register_rest_routes();
}
}

new Angie_Demo_Plugin();
