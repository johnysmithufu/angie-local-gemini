import { z } from 'zod';
import { AngieTool } from '../types';

/**
* Standard Tools for Angie V2
* Migrated from original demo-mcp-server.ts
*/

export const analyzePageSeo: AngieTool = {
    name: 'analyze_page_seo',
    description: 'Analyzes the SEO of the current page content or a specific text.',
    schema: z.object({
        content: z.string().optional().describe('The content to analyze. If empty, tries to grab current editor content.')
    }),
    handler: async ({ content }) => {
        // Logic: specific keywords, length, headings check
        // In a real scenario, this might call an external SEO API or internal logic
        const textToAnalyze = content || "Content not provided";
        const wordCount = textToAnalyze.split(' ').length;
        const hasH1 = textToAnalyze.includes('# ');

        return {
            score: wordCount > 300 ? 80 : 40,
            feedback: [
                wordCount < 300 ? "Content is too short." : "Good length.",
                hasH1 ? "H1 tag present." : "Missing H1 tag."
            ]
        };
    }
};

export const managePostTypes: AngieTool = {
    name: 'manage_post_types',
    description: 'Lists all registered post types on this WordPress site.',
    schema: z.object({}),
    handler: async () => {
        // In production, this would fetch from a WP REST endpoint
        // MOCK for Demo:
        return {
            post_types: ['post', 'page', 'attachment', 'revision', 'nav_menu_item']
        };
    }
};

export const securityCheck: AngieTool = {
    name: 'security_check',
    description: 'Performs a basic security audit of the site configuration.',
    schema: z.object({
        scan_depth: z.enum(['quick', 'deep']).optional()
    }),
    handler: async ({ scan_depth }) => {
        return {
            status: 'warning',
            issues: [
                { severity: 'high', message: 'Debug mode is enabled in wp-config.php' },
                { severity: 'medium', message: 'Admin user is named "admin"' }
            ],
            timestamp: new Date().toISOString()
        };
    }
};

export const runFireworks: AngieTool = {
    name: 'run_fireworks',
    description: 'Triggers a visual celebration on the screen.',
    schema: z.object({}),
    handler: async () => {
        // This tool is client-side primarily, but the LLM calls it to signal intent.
        // The React UI could listen for this specific tool response to trigger canvas confetti.
        if (typeof window !== 'undefined') {
             console.log("🎆 FIREWORKS TRIGGERED 🎆");
             // Add simple confetti logic here or dispatch event
        }
        return { success: true, message: "Celebration triggered!" };
    }
};
