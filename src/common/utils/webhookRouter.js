const partnerService = require('../../modules/partners/services/partnerService');
const bookingService = require('../../modules/bookings/services/bookingService');

/**
 * Routes webhook data to the correct module based on order_id prefix
 * 
 * Order ID formats:
 * - bkg_42_1737691200000 → Booking (User service payment)
 * - ptn_123_1737691200000 → Partner (Partner registration payment)
 */
async function routeWebhook(webhookData) {
  const { type, data } = webhookData;
  const orderId = data?.order?.order_id;
  
  if (!orderId) {
    console.error('[Webhook Router] Missing order_id in webhook data');
    throw Object.assign(
      new Error('Invalid webhook data - missing order_id'),
      { status: 400 }
    );
  }

  console.log('[Webhook Router] Routing webhook:', {
    type,
    orderId,
    timestamp: new Date().toISOString()
  });

  // Extract prefix from order_id
  const parts = String(orderId).split('_');
  const prefix = parts[0];
  const entityId = parts[1];

  // Validate order_id format
  if (!prefix || !entityId || parts.length < 3) {
    console.error('[Webhook Router] Invalid order_id format:', { orderId });
    throw Object.assign(
      new Error(`Invalid order_id format: ${orderId}. Expected format: {prefix}_{id}_{timestamp}`),
      { status: 400 }
    );
  }

  console.log('[Webhook Router] Order details:', {
    orderId,
    prefix,
    entityId,
    type
  });

  // Route based on prefix
  switch (prefix) {
    case 'bkg':
      console.log('[Webhook Router] ✅ Routing to Booking Service');
      return await bookingService.processWebhook(webhookData);

    case 'ptn':
      console.log('[Webhook Router] ✅ Routing to Partner Service');
      return await partnerService.processWebhook(webhookData);

    default:
      console.error('[Webhook Router] ❌ Unknown order prefix:', {
        orderId,
        prefix,
        validPrefixes: ['bkg (Booking)', 'ptn (Partner)']
      });
      throw Object.assign(
        new Error(`Unknown order prefix: "${prefix}". Expected "bkg" for bookings or "ptn" for partners`),
        { status: 400 }
      );
  }
}

module.exports = { routeWebhook };