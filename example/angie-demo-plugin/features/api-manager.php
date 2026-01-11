<?php
/**
 * API Manager - "The Gatekeeper"
 * * Merges ideas from:
 * - Claude: Streaming Proxy support (flush buffers)
 * - DeepSeek: Security Headers, Rate Limiting, Logging
 * - Gemini: Secure File Access
 */

namespace Angie\Features;

class ApiManager {
    private $api_key;
    private $rate_limit_window = 60; // 1 minute
    private $rate_limit_requests = 20;

    public function __construct() {
        // MERGED: Securely fetch key from DB, never hardcoded (DeepSeek)
        $this->api_key = get_option('angie_gemini_api_key');

        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes() {
        register_rest_route('angie/v1', '/generate', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_generation'],
            'permission_callback' => [$this, 'check_permission'], // MERGED: Strict permissions
        ]);

        // Added Config Endpoints for ChatInterface
        register_rest_route('angie/v1', '/config/check', [
            'methods' => 'GET',
            'callback' => [$this, 'handle_check_config'],
            'permission_callback' => function() { return current_user_can('manage_options'); },
        ]);

        register_rest_route('angie/v1', '/config/save', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_save_config'],
            'permission_callback' => function() { return current_user_can('manage_options'); },
        ]);
    }

    /**
     * MERGED: Permission + Rate Limiting (DeepSeek)
     */
    public function check_permission($request) {
        if (!current_user_can('manage_options')) {
            return new \WP_Error('rest_forbidden', 'Only admins can use Angie.', ['status' => 403]);
        }

        $user_id = get_current_user_id();
        if ($this->is_rate_limited($user_id)) {
            return new \WP_Error('rest_limit_exceeded', 'Rate limit exceeded.', ['status' => 429]);
        }

        return true;
    }

    private function is_rate_limited($user_id) {
        $transient_key = 'angie_rate_' . $user_id;
        $current_requests = get_transient($transient_key) ?: 0;

        if ($current_requests >= $this->rate_limit_requests) {
            return true;
        }

        set_transient($transient_key, $current_requests + 1, $this->rate_limit_window);
        return false;
    }

    public function handle_check_config() {
        return [
            'has_key' => !empty(get_option('angie_gemini_api_key'))
        ];
    }

    public function handle_save_config($request) {
        $params = $request->get_json_params();
        if (empty($params['api_key'])) {
            return new \WP_Error('missing_key', 'API Key required', ['status' => 400]);
        }

        update_option('angie_gemini_api_key', sanitize_text_field($params['api_key']));
        // Update the instance key as well for immediate use if needed (though new requests will fetch from option)
        $this->api_key = $params['api_key'];

        return ['success' => true];
    }

    /**
     * MERGED: Streaming Proxy (Claude)
     * This method handles the connection to Gemini and streams it back to the React UI
     * bypassing standard WP output buffering.
     */
    public function handle_generation($request) {
        $params = $request->get_json_params();

        // Refresh key in case it was just saved
        if (empty($this->api_key)) {
             $this->api_key = get_option('angie_gemini_api_key');
        }

        if (empty($this->api_key)) {
             return new \WP_Error('no_key', 'API Key not configured', ['status' => 500]);
        }

        // 1. Prepare Google API Request
        // Note: Using $request->get_body() directly might be safer for empty objects in tools,
        // but here we are constructing the request to Google manually.
        // We need to ensure structure is correct.

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?key=' . $this->api_key;

        // 2. Setup Headers for SSE (Server-Sent Events)
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no'); // Nginx specific

        // 3. Open Stream to Google
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);

        // Construct body.
        // Note: $params is already parsed JSON. We need to re-encode it for Google.
        // Google expects { contents: [...] } or { contents: [...], tools: [...] }
        // The Client sends { model:..., messages:..., tools:..., stream:... }
        // We need to map Client payload to Google payload.
        // GeminiClient sends: { model:..., messages: [...], tools: [...], stream: true }
        // Google API expects: { contents: [...], tools: [...], systemInstruction: ... }
        // Client Messages: { role: 'user', content: ..., images: ... }
        // We need to transform Client Messages to Google Content format.

        // Transform messages
        $contents = [];
        $system_instruction = null;

        foreach ($params['messages'] as $msg) {
            if ($msg['role'] === 'system') {
                $system_instruction = ['parts' => [['text' => $msg['content']]]];
                continue;
            }

            $parts = [];
            if (!empty($msg['content'])) {
                $parts[] = ['text' => $msg['content']];
            }
            if (!empty($msg['images'])) {
                foreach ($msg['images'] as $base64) {
                    $parts[] = [
                        'inline_data' => [
                            'mime_type' => 'image/jpeg',
                            'data' => $base64
                        ]
                    ];
                }
            }

            $contents[] = [
                'role' => $msg['role'],
                'parts' => $parts
            ];
        }

        $google_payload = [
            'contents' => $contents
        ];

        if ($system_instruction) {
             $google_payload['systemInstruction'] = $system_instruction;
        }

        if (!empty($params['tools'])) {
             // Tools need to be formatted for Google
             // Client sends registry: [{ name, description, parameters }]
             // Google expects: { function_declarations: [...] }
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

        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($google_payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

        // Write function to stream data as it comes
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($curl, $data) {
            // MERGED: Logging Hook (Claude Analytics)
            do_action('angie_log_token_usage', strlen($data));

            echo "data: " . $data . "\n\n";

            if (ob_get_level() > 0) {
                ob_flush();
            }
            flush();
            return strlen($data);
        });

        curl_exec($ch);

        if (curl_errno($ch)) {
             // Handle error
             echo "data: " . json_encode(['error' => curl_error($ch)]) . "\n\n";
        }

        curl_close($ch);

        echo "data: [DONE]\n\n";
        flush();
        exit; // Terminate WP execution to prevent extra output
    }
}
