import catalogue from '../../lib/regional-catalogue';
import {createDashboardHandler} from '../../lib/dashboard-api';
export default createDashboardHandler({items:catalogue.items});
