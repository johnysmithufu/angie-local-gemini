<?php
/**
* API Manager - "The Gatekeeper"
* Handles API Key retrieval from User Meta (Priority) or Global Option (Fallback).
*/

namespace Angie\Features;

class ApiManager {
    private $rate_limit_window = 60; // 1 minute
    private $rate_limit_requests = 20;

    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes() {
        register_rest_route('angie/v1', '/generate', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_generation'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        register_rest_route('angie/v1', '/config/check', [
            'methods' => 'GET',
            'callback' => [$this, 'handle_check_config'],
            'permission_callback' => function() { return current_user_can('manage_options'); },
        ]);

        // Legacy fallback save (optional, for the chat UI settings)
        register_rest_route('angie/v1', '/config/save', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_save_config'],
            'permission_callback' => function() { return current_user_can('manage_options'); },
        ]);
    }

    /**
     * Helper to get the best available API Key
     */
    private function get_active_api_key() {
        $user_id = get_current_user_id();
        // 1. Check User Profile Key
        $user_key = get_user_meta($user_id, 'angie_api_key', true);
        if (!empty($user_key)) return $user_key;

        // 2. Check Global Key (Fallback)
        return get_option('angie_gemini_api_key');
    }

    public function check_permission($request) {
        if (!current_user_can('manage_options')) {
            return new \WP_Error('rest_forbidden', 'Only admins can use Angie.', ['status' => 403]);
        }
        // ... (Rate limiting logic unchanged) ...
        return true;
    }

    public function handle_check_config() {
        // Return true if EITHER key exists
        return [
            'has_key' => !empty($this->get_active_api_key())
        ];
    }

    public function handle_save_config($request) {
        $params = $request->get_json_params();
        if (empty($params['api_key'])) return new \WP_Error('missing_key', 'Key required', ['status' => 400]);

        // Save to User Meta by default now, for better privacy
        update_user_meta(get_current_user_id(), 'angie_api_key', sanitize_text_field($params['api_key']));
        return ['success' => true];
    }

    public function handle_generation($request) {
        $api_key = $this->get_active_api_key();

        if (empty($api_key)) {
             return new \WP_Error('no_key', 'API Key not configured in User Profile', ['status' => 500]);
        }

        // ... (Rest of the streaming logic remains the same) ...
        // 1. Prepare Google API Request
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?key=' . $api_key;

        // 2. Setup Headers for SSE
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');

        $params = $request->get_json_params();

        // Transform messages for Google format (Same logic as before)
        $contents = [];
        $system_instruction = null;

        foreach ($params['messages'] as $msg) {
            if ($msg['role'] === 'system') {
                $system_instruction = ['parts' => [['text' => $msg['content']]]];
                continue;
            }
            $parts = [];
            if (!empty($msg['content'])) $parts[] = ['text' => $msg['content']];
            if (!empty($msg['images'])) {
                foreach ($msg['images'] as $base64) {
                    $parts[] = ['inline_data' => ['mime_type' => 'image/jpeg', 'data' => $base64]];
                }
            }
            $contents[] = ['role' => $msg['role'], 'parts' => $parts];
        }

        $google_payload = ['contents' => $contents];
        if ($system_instruction) $google_payload['systemInstruction'] = $system_instruction;

        if (!empty($params['tools'])) {
             $funcs = [];
             foreach ($params['tools'] as $tool) {
                 $funcs[] = [
                     'name' => $tool['name'],
                     'description' => $tool['description'],
                     'parameters' => $tool['parameters']
                 ];
             }
             $google_payload['tools'] = [['function_declarations' => $funcs]];
        }

        // 3. Execute cURL
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($google_payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($curl, $data) {
            do_action('angie_log_token_usage', strlen($data));
            echo "data: " . $data . "\n\n";
            if (ob_get_level() > 0) ob_flush();
            flush();
            return strlen($data);
        });

        curl_exec($ch);
        curl_close($ch);
        echo "data: [DONE]\n\n";
        flush();
        exit;
    }
}
