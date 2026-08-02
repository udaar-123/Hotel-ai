import { formatSuccessResponse } from '@/shared/errors';

export async function GET() {
  return formatSuccessResponse({ status: 'ok', timestamp: new Date().toISOString() });
}
