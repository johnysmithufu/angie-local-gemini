<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Angie_Demo_Api_Manager {

    public function register_rest_routes() {
        register_rest_route( Angie_Demo_Plugin::REST_NAMESPACE, '/save-key', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'save_api_key' ],
            'permission_callback' => [ $this, 'permissions_check' ],
        ] );
    }

    public function permissions_check() {
        return current_user_can( 'manage_options' );
    }

    public function save_api_key( $request ) {
        $params  = $request->get_json_params();
        $key     = sanitize_text_field( $params['key'] ?? '' );
        $user_id = get_current_user_id();

        if ( empty( $key ) ) {
            delete_user_meta( $user_id, 'angie_gemini_api_key' );
            return [ 'success' => true, 'message' => 'API Key removed successfully.' ];
        }

        update_user_meta( $user_id, 'angie_gemini_api_key', $key );

        return [ 'success' => true, 'message' => 'API Key saved securely.' ];
    }
}
