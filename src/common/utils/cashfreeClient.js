const axios = require('axios');
const env = require('../config/env');

// Raw Cashfree REST calls only — the cashfree-pg SDK must never be used.
const BASE_URL = env.cashfreeEnv === 'PRODUCTION'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

function headers() {
  return {
    'x-api-version': env.cashfreeApiVersion,
    'x-client-id': env.cashfreeClientId,
    'x-client-secret': env.cashfreeClientSecret,
    'Content-Type': 'application/json'
  };
}

async function createOrder({ order_id, order_amount, order_currency = 'INR', customer_details, order_meta, order_note }) {
  const body = {
    order_id,
    order_amount,
    order_currency,
    customer_details,
    order_meta: {
      return_url: env.cashfreeReturnUrl,
      ...order_meta
    },
    order_note
  };

  const { data } = await axios.post(`${BASE_URL}/orders`, body, { headers: headers() });
  return data;
}

async function fetchOrder(orderId) {
  const { data } = await axios.get(`${BASE_URL}/orders/${orderId}`, { headers: headers() });
  return data;
}

module.exports = { createOrder, fetchOrder };
