<?php
/**
* Plugin Name: Angie Demo - Local AI Edition
* Description: A standalone, privacy-focused version of Angie that runs MCP tools locally using Google Gemini.
* Version: 2.0.1
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
require_once plugin_dir_path( __FILE__ ) . 'features/api-manager.php';

class Angie_Demo_Plugin {

    const VERSION = '2.0.1';
    const REST_NAMESPACE = 'angie-demo/v1';

    private $seo_analyzer;
    private $post_type_manager;
    private $security_checker;
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
        $this->api_manager       = new Angie_Demo_Api_Manager();
    }

    public function render_app_root() {
        if ( current_user_can( 'manage_options' ) ) {
            echo '<div id="angie-local-root"></div>';
        }
    }

    public function enqueue_scripts() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $script_url = plugin_dir_url( __FILE__ ) . 'out/angie-demo.js';
        $ver        = file_exists( plugin_dir_path( __FILE__ ) . 'out/angie-demo.js' )
            ? filemtime( plugin_dir_path( __FILE__ ) . 'out/angie-demo.js' )
            : self::VERSION;

        wp_enqueue_script(
            'angie-demo-local',
            $script_url,
            [ 'wp-element', 'wp-api-fetch', 'wp-i18n' ],
            $ver,
            true
        );

        $user_id = get_current_user_id();
        $api_key = get_user_meta( $user_id, 'angie_gemini_api_key', true );

        // SECURE CHANGE: We do NOT send 'apiKey' anymore.
        wp_localize_script( 'angie-demo-local', 'angieLocalSettings', [
            'root'      => esc_url_raw( rest_url() ),
            'nonce'     => wp_create_nonce( 'wp_rest' ),
            'hasApiKey' => ! empty( $api_key ), // Boolean flag for UI state
            'userName'  => wp_get_current_user()->display_name,
        ] );
    }

    public function register_rest_routes() {
        $this->seo_analyzer->register_rest_routes();
        $this->post_type_manager->register_rest_routes();
        $this->security_checker->register_rest_routes();
        $this->api_manager->register_rest_routes();
    }
}

new Angie_Demo_Plugin();
