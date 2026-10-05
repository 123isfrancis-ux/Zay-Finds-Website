import catalogue from '../../lib/regional-catalogue';
import { createTrendingHandler } from '../../lib/trending-api';
const validIds = new Set(catalogue.items.filter(item => item.visibility !== 'hidden').map(item => item.id));
export default createTrendingHandler({validIds});
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
