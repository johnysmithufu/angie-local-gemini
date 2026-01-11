<?php
/**
* Plugin Name: Angie Demo - Local AI Edition
* Description: A standalone, privacy-focused version of Angie that runs MCP tools locally using Google Gemini.
* Version: 2.0.4
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
require_once plugin_dir_path( __FILE__ ) . 'features/user-profile-settings.php'; // <--- NEW FILE
require_once plugin_dir_path( __FILE__ ) . 'features/api-manager.php';
require_once plugin_dir_path( __FILE__ ) . 'features/analytics-logger.php';

class Angie_Demo_Plugin {

const VERSION = '2.0.4';
const REST_NAMESPACE = 'angie/v1';

const POST_TYPES_OPTION = 'angie_demo_post_types';

private $seo_analyzer;
private $post_type_manager;
private $security_checker;
private $user_profile_settings; // <--- NEW PROPERTY
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
$this->user_profile_settings = new Angie\Features\UserProfileSettings(); // <--- INIT NEW FEATURE
$this->api_manager       = new Angie\Features\ApiManager();
}

public function render_app_root() {
if ( current_user_can( 'manage_options' ) ) {
            // This is where the React App mounts.
            // If the CSS is missing, this div (and its children) will sit in the footer flow.
            // Ensure you have applied the CSS fix from the previous step to float it!
echo '<div id="angie-local-root"></div>';
}
}

public function enqueue_scripts() {
if ( ! current_user_can( 'manage_options' ) ) {
return;
}

$script_url = plugin_dir_url( __FILE__ ) . 'out/angie-demo.js';
        $style_url = plugin_dir_url( __FILE__ ) . 'out/angie-demo.css';

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

        // Ensure CSS is enqueued to prevent "squeezed in footer" look
        if ( file_exists( plugin_dir_path( __FILE__ ) . 'out/angie-demo.css' ) ) {
            wp_enqueue_style(
                'angie-demo-style',
                $style_url,
                [],
                $ver
            );
        }

wp_localize_script( 'angie-demo-local', 'angieConfig', [
'apiBaseUrl' => esc_url_raw( rest_url() ),
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
