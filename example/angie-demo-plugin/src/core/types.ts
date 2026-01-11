import { z } from 'zod';

export interface AngieTool {
    name: string;
    description: string;
    schema: z.ZodObject<any>;
    handler: (args: any) => Promise<any>;
    requiresConfirmation?: boolean;
    isEnabled?: boolean;
    confidenceThreshold?: number;
}
