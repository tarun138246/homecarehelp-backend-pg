const axios = require('axios');
const env = require('../config/env');

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

  const response = await axios.post(`${BASE_URL}/orders`, body, { headers: headers() });
  
  //Serialize and deserialize to strip any prototype pollution
  const cleanData = JSON.parse(JSON.stringify(response.data));
  
  // Return only needed fields as primitive strings
  return {
    order_id: String(cleanData.order_id || ''),
    payment_session_id: String(cleanData.payment_session_id || '')
  };
}

async function fetchOrder(orderId) {
  const response = await axios.get(`${BASE_URL}/orders/${orderId}`, { headers: headers() });
  const cleanData = JSON.parse(JSON.stringify(response.data));
  return cleanData;
}

module.exports = { createOrder, fetchOrder };