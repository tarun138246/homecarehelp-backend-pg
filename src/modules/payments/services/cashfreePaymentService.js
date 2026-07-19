const cashfreeClient = require('../../../common/utils/cashfreeClient');

// Shared Cashfree order logic reused by both bookings and partners.
// No public routes of its own — each domain exposes its own
// /create-order and /confirm-order endpoints that call into this.

/**
 * Creates a Cashfree order. `prefix` + `entityId` are embedded into our own
 * order_id (e.g. "bkg_42_1737288000000") so confirmOrder can reliably map a
 * Cashfree order back to the booking/partner it belongs to, without relying
 * on order_note being echoed back by Cashfree.
 */
async function createOrder({ prefix, entityId, amount, customerName, customerEmail, customerPhone }) {
  const order_id = `${prefix}_${entityId}_${Date.now()}`;

  const order = await cashfreeClient.createOrder({
    order_id,
    order_amount: amount.toString(),
    customer_details: {
      customer_id: entityId.toString(),
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone
    }
  });

  return {
    order_id: order.order_id,
    payment_session_id: order.payment_session_id
  };
}

/**
 * Fetches an order from Cashfree and normalizes the fields we care about.
 * Throws if the order_id doesn't match the expected prefix (defends against
 * a booking's confirm-order call being fed a partner order id, etc).
 */
async function confirmOrder({ orderId, expectedPrefix }) {
  const order = await cashfreeClient.fetchOrder(orderId);

  const parts = String(order.order_id || orderId).split('_');
  if (parts[0] !== expectedPrefix || !parts[1]) {
    throw Object.assign(new Error('Order does not belong to this flow'), { status: 400 });
  }

  return {
    order_id: order.order_id,
    payment_session_id: order.payment_session_id,
    order_amount: order.order_amount,
    order_status: order.order_status,
    payment_methods: order.order_meta?.payment_methods ?? null,
    entityId: parts[1]
  };
}

module.exports = { createOrder, confirmOrder };
