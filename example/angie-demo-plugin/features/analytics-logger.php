<?php
/**
 * OMISSION FIX: Claude Suggestion - "Usage Tracking"
 * Implements the listener for the 'angie_log_token_usage' hook defined in api-manager.php.
 * Tracks estimated cost and usage per user.
 */

namespace Angie\Features;

class AnalyticsLogger {
    private $table_name;

    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'angie_analytics';

        // Initialize DB on plugin activation (logic simplified for snippet)
        add_action('plugins_loaded', [$this, 'check_db_install']);

        // The Hook Listener
        add_action('angie_log_token_usage', [$this, 'log_request'], 10, 1);
    }

    public function check_db_install() {
        if (get_option('angie_analytics_db_version') !== '1.0') {
            $this->create_table();
        }
    }

    private function create_table() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE $this->table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            time datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
            user_id bigint(20) NOT NULL,
            bytes_streamed int(11) NOT NULL,
            estimated_cost decimal(10, 6) DEFAULT 0,
            model varchar(50) DEFAULT 'gemini-2.0-flash-exp',
            PRIMARY KEY  (id)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);

        update_option('angie_analytics_db_version', '1.0');
    }

    /**
     * Logs the usage from the streaming proxy.
     * Note: Exact token counting is hard with streaming, so we estimate based on bytes.
     * * @param int $bytes_streamed The length of the data chunk sent to the client.
     */
    public function log_request($bytes_streamed) {
        global $wpdb;

        // Basic estimation: 1 char ~= 1 byte. 4 chars ~= 1 token.
        // Cost: Gemini Flash is free (preview) or extremely cheap.
        // This is a placeholder calculation.
        $estimated_tokens = ceil($bytes_streamed / 4);
        $cost_per_1k_tokens = 0.0001; // Example rate
        $cost = ($estimated_tokens / 1000) * $cost_per_1k_tokens;

        $wpdb->insert(
            $this->table_name,
            [
                'time' => current_time('mysql'),
                'user_id' => get_current_user_id(),
                'bytes_streamed' => $bytes_streamed,
                'estimated_cost' => $cost,
                'model' => 'gemini-2.0-flash-exp'
            ]
        );
    }
}

new AnalyticsLogger();
