import watermelonEventJson from './watermelonEvent.json' with { type: 'json' };
import { EventSchema } from '../schemas/event.js';

export const watermelonEventFixture = EventSchema.parse(watermelonEventJson);
