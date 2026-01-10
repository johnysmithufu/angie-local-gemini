/**
* MCP Server for Angie Demo Plugin (Local Edition)
*/

import { AngieMcpSdk, McpServer } from './local-sdk/replacement-sdk';
import { Fireworks } from 'fireworks-js';
import { z } from 'zod';

interface WpApiSettings {
    root: string;
    nonce?: string;
}

declare global {
    interface Window {
        wpApiSettings: WpApiSettings;
        angieLocalSettings?: any;
    }
}

const getApiRoot = () => window.angieLocalSettings?.root || window.wpApiSettings?.root || '/wp-json/';
const getNonce = () => window.angieLocalSettings?.nonce || window.wpApiSettings?.nonce || '';

async function makeApiRequest( endpoint: string, data: Record<string, unknown> ): Promise<any> {
    const root = getApiRoot();
    const cleanRoot = root.endsWith('/') ? root : root + '/';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = cleanRoot + cleanEndpoint;

    const response = await fetch( url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': getNonce(),
        },
        body: JSON.stringify( data ),
    } );

    if ( ! response.ok ) throw new Error( `HTTP error! status: ${ response.status }` );
    return await response.json();
}

function createSeoMcpServer() {
    const server = new McpServer(
        { name: 'angie-demo-server', version: '2.0.0' },
        { capabilities: { tools: {} } }
    );

    server.tool(
        'analyze-page-seo',
        'Analyzes SEO of current page',
        { url: z.string() },
        async ( { url } ) => {
            const res = await makeApiRequest( 'angie-demo/v1/analyze-page-seo', { url } );
            return { content: [ { type: 'text', text: JSON.stringify( res, null, 2 ) } ] };
        } );

    server.tool(
        'manage-post-types',
        'Manages post types',
        { postType: z.string(), action: z.enum( [ 'register', 'unregister' ] ) },
        async ( { postType, action } ) => {
            const res = await makeApiRequest( 'angie-demo/v1/post-types', { postType, action } );
            return { content: [ { type: 'text', text: JSON.stringify( res, null, 2 ) } ] };
        } );

    server.tool(
        'security-check',
        'Checks WP security',
        {},
        async () => {
            const res = await makeApiRequest( 'angie-demo/v1/security-check', {} );
            return { content: [ { type: 'text', text: JSON.stringify( res, null, 2 ) } ] };
        } );

    server.tool( 'run-fireworks',
        'Runs fireworks animation',
        {},
        async () => {
            try {
                let canvas = document.getElementById( 'fireworks-canvas' ) as HTMLCanvasElement;
                if ( ! canvas ) {
                    canvas = document.createElement( 'canvas' );
                    canvas.id = 'fireworks-canvas';
                    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;pointer-events:none;';
                    document.body.appendChild( canvas );
                }

                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                const fireworks = new Fireworks( canvas );
                fireworks.start();

                setTimeout( () => {
                    fireworks.stop();
                    setTimeout( () => { canvas?.remove(); }, 1000 );
                }, 5000 );

                return { content: [ { type: 'text', text: 'Fireworks running.' } ] };
            } catch ( error ) {
                return { content: [ { type: 'text', text: 'Failed to start fireworks.' } ] };
            }
        } );

    return server;
}

const init = async () => {
    const server = createSeoMcpServer();
    const sdk = new AngieMcpSdk();
    await sdk.registerServer( {
        name: 'angie-demo-server',
        version: '2.0.0',
        server,
    } );
};

init();
