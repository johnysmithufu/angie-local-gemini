<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Angie_Demo_Api_Manager {

	public function register_rest_routes() {
		// Route to save the key
		register_rest_route( Angie_Demo_Plugin::REST_NAMESPACE, '/save-key', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'save_api_key' ],
			'permission_callback' => [ $this, 'permissions_check' ],
		] );

		// NEW: Route to list models
		register_rest_route( Angie_Demo_Plugin::REST_NAMESPACE, '/models', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'proxy_list_models' ],
			'permission_callback' => [ $this, 'permissions_check' ],
		] );

		// Route to proxy the request to Gemini
		register_rest_route( Angie_Demo_Plugin::REST_NAMESPACE, '/generate', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'proxy_generate' ],
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
			return [ 'success' => true, 'message' => 'API Key removed.' ];
		}

		update_user_meta( $user_id, 'angie_gemini_api_key', $key );
		return [ 'success' => true, 'message' => 'API Key saved.' ];
	}

	public function proxy_list_models( $request ) {
		$user_id = get_current_user_id();
		$api_key = get_user_meta( $user_id, 'angie_gemini_api_key', true );

		if ( empty( $api_key ) ) {
			return new WP_Error( 'missing_key', 'API Key not found.', [ 'status' => 400 ] );
		}

		$url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' . $api_key;

		$response = wp_remote_get( $url );

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'gemini_error', $response->get_error_message(), [ 'status' => 500 ] );
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		// Filter for models that support 'generateContent'
		$models = [];
		if ( ! empty( $body['models'] ) ) {
			foreach ( $body['models'] as $model ) {
				if ( in_array( 'generateContent', $model['supportedGenerationMethods'] ?? [] ) ) {
					// Clean up the name (remove 'models/' prefix)
					$model['name'] = str_replace( 'models/', '', $model['name'] );
					$models[] = $model;
				}
			}
		}

		return [ 'models' => $models ];
	}

	public function proxy_generate( $request ) {
		$user_id = get_current_user_id();
		$api_key = get_user_meta( $user_id, 'angie_gemini_api_key', true );

		if ( empty( $api_key ) ) {
			return new WP_Error( 'missing_key', 'API Key not found. Please check settings.', [ 'status' => 400 ] );
		}

		// Get model from Query Param, default to stable 1.5 flash
		$model = $request->get_param( 'model' );
		if ( empty( $model ) ) {
			$model = 'gemini-1.5-flash';
		}

		// Sanitize model name to prevent injection, allow dots and dashes
		$model = preg_replace( '/[^a-zA-Z0-9\-\.]/', '', $model );

		// CRITICAL: Get raw body string to preserve empty objects "{}"
		$raw_body = $request->get_body();

		$url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . $api_key;

		$response = wp_remote_post( $url, [
			'body'    => $raw_body, // Send raw string
			'headers' => [ 'Content-Type' => 'application/json' ],
			'timeout' => 60,
		] );

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'gemini_error', $response->get_error_message(), [ 'status' => 500 ] );
		}

		$response_body = wp_remote_retrieve_body( $response );
		$decoded = json_decode( $response_body, true );

		// Forward Google's error if it exists
		if ( isset( $decoded['error'] ) ) {
			return new WP_Error( 'gemini_api_error', $decoded['error']['message'], [ 'status' => 400 ] );
		}

		return $decoded;
	}
}
