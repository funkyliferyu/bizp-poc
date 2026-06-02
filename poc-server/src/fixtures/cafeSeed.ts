import cafeSeedJson from './cafeSeed.json' with { type: 'json' };
import { BusinessMemorySchema } from '../schemas/businessMemory.js';

export const cafeSeedFixture = BusinessMemorySchema.parse(cafeSeedJson);
