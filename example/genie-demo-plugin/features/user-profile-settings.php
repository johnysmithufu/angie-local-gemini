<?php
/**
* User Profile Settings
* Adds an "Genie AI Settings" section to the WordPress User Profile page.
*/

namespace Genie\Features;

class UserProfileSettings {

    public function __construct() {
        add_action('show_user_profile', [$this, 'render_profile_fields']);
        add_action('edit_user_profile', [$this, 'render_profile_fields']);

        add_action('personal_options_update', [$this, 'save_profile_fields']);
        add_action('edit_user_profile_update', [$this, 'save_profile_fields']);
    }

    public function render_profile_fields($user) {
        if (!current_user_can('manage_options')) return;

        $api_key = get_user_meta($user->ID, 'genie_api_key', true);
        ?>
        <h3>Genie AI Settings</h3>
        <table class="form-table">
            <tr>
                <th><label for="genie_api_key">Google Gemini API Key</label></th>
                <td>
                    <input type="password" name="genie_api_key" id="genie_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                    <p class="description">
                        Enter your Gemini API key here. It will be used for your interactions with Genie.
                        <br>
                        <a href="https://makersuite.google.com/app/apikey" target="_blank">Get a key from Google AI Studio</a>.
                    </p>
                </td>
            </tr>
        </table>
        <?php
    }

    public function save_profile_fields($user_id) {
        if (!current_user_can('manage_options')) return;

        if (isset($_POST['genie_api_key'])) {
            update_user_meta($user_id, 'genie_api_key', sanitize_text_field($_POST['genie_api_key']));
        }
    }
}

new UserProfileSettings();
