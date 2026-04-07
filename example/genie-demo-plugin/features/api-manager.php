<?php
/**
* API Manager - "The Gatekeeper"
* Handles API Key retrieval from User Meta (Priority) or Global Option (Fallback).
*/

namespace Genie\Features;

class ApiManager {
    private $rate_limit_window = 60; // 1 minute
    private $rate_limit_requests = 20;

    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes() {
        register_rest_route('genie/v1', '/generate', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_generation'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        register_rest_route('genie/v1', '/config/check', [
            'methods' => 'GET',
            'callback' => [$this, 'handle_check_config'],
            'permission_callback' => function() { return current_user_can('manage_options'); },
        ]);

        register_rest_route('genie/v1', '/config/save', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_save_config'],
            'permission_callback' => function() { return current_user_can('manage_options'); },
        ]);

        register_rest_route('genie/v1', '/models', [
            'methods' => 'GET',
            'callback' => [$this, 'handle_get_models'],
            'permission_callback' => [$this, 'check_permission'],
        ]);
    }

    private function get_active_api_key() {
        $user_id = get_current_user_id();
        $user_key = get_user_meta($user_id, 'genie_api_key', true);
        if (!empty($user_key)) return $user_key;
        return get_option('genie_gemini_api_key');
    }

    public function check_permission($request) {
        if (!current_user_can('manage_options')) {
            return new \WP_Error('rest_forbidden', 'Only admins can use Genie.', ['status' => 403]);
        }
        return true;
    }

    public function handle_check_config() {
        return [
            'has_key' => !empty($this->get_active_api_key())
        ];
    }

    public function handle_save_config($request) {
        $params = $request->get_json_params();
        if (empty($params['api_key'])) return new \WP_Error('missing_key', 'Key required', ['status' => 400]);

        update_user_meta(get_current_user_id(), 'genie_api_key', sanitize_text_field($params['api_key']));
        return ['success' => true];
    }

    public function handle_get_models() {
        $api_key = $this->get_active_api_key();

        if (empty($api_key)) {
            return new \WP_Error('no_key', 'API Key not configured in User Profile', ['status' => 500]);
        }

        $url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' . $api_key;

        $response = wp_remote_get($url);

        if (is_wp_error($response)) {
            return $response;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        return rest_ensure_response($data);
    }

    public function handle_generation($request) {
        $api_key = $this->get_active_api_key();

        if (empty($api_key)) {
             return new \WP_Error('no_key', 'API Key not configured in User Profile', ['status' => 500]);
        }

        $params = $request->get_json_params();
        $model = !empty($params['model']) ? sanitize_text_field($params['model']) : 'gemini-2.5-flash-lite';

        // Strip out 'models/' prefix if provided by the client
        if (strpos($model, 'models/') === 0) {
            $model = substr($model, 7);
        }

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':streamGenerateContent?key=' . $api_key;

        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');

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

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($google_payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($curl, $data) {
            do_action('genie_log_token_usage', strlen($data));
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
