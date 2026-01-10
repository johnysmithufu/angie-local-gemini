Angie Local AI (Gemini Edition) 🤖✨
​A standalone, privacy-focused fork of the Angie AI Assistant for WordPress.
​This project replaces the cloud-based Elementor Angie infrastructure with a Local React Interface that connects directly to Google Gemini. It allows you to run Model Context Protocol (MCP) tools on your WordPress site without external dependencies or subscriptions—just bring your own API key.
​✨ Key Features
​100% Local Execution: No communication with Elementor Cloud servers. All logic runs in your browser and your WordPress backend.
​Google Gemini 2.0 Flash: Powered by Google's latest high-performance model for fast reasoning.
​Secure Proxy: API requests are proxied through your WordPress backend (/wp-json/angie-demo/v1/generate) to avoid CORS issues and keep your API key secure.
​React Chat UI: A beautiful, responsive chat interface built with React and Lucide icons, injected directly into your WP Admin.
​MCP Architecture: Uses the standard Model Context Protocol. The "Brain" (LLM) and "Tools" (PHP) are decoupled, making it easy to add new capabilities.
​🛠 Included Tools
​Out of the box, this plugin includes 4 demonstration tools:
​SEO Analyzer: Audits the current page for meta tags, headings, and content length.
​Security Checker: Checks WordPress version, debug mode, and file editing permissions.
​Post Type Manager: Can register or unregister custom post types via chat.
​Fireworks: A fun tool that spawns a fireworks animation on screen (demonstrates DOM manipulation).
​📦 Installation (No PC Required)
​You can build and install this plugin entirely from your browser (ideal for Android/iPad users) using GitHub Actions.
​Method 1: GitHub Actions (Recommended)
​Fork this repository.
​Go to the Actions tab.
​Select the Build Plugin workflow on the left.
​Click Run workflow.
​Wait for the build to finish (green checkmark).
​Click the run to open details, then scroll down to Artifacts.
​Download angie-local-ai.
​Upload this zip file directly to your WordPress site (Plugins > Add New > Upload).
​Method 2: Local Build (Developers)
​If you have a PC with Node.js installed:
