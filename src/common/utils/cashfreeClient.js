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
  

  const rawText = JSON.stringify(response.data);
  const parsed = JSON.parse(rawText);
  
  // Extract session ID from clean parsed object
  const sessionId = parsed.payment_session_id;
  
  // Check if corrupted and fix
  let cleanSessionId = sessionId;
  if (typeof cleanSessionId === 'string' && cleanSessionId.includes('paymentpayment')) {
    // Split on 'paymentpayment' and take the first part
    cleanSessionId = cleanSessionId.split('paymentpayment')[0];
  }
  
  // Ensure it starts with 'session_'
  if (!cleanSessionId.startsWith('session_')) {
    const match = cleanSessionId.match(/(session_[a-zA-Z0-9_-]+)/);
    if (match) {
      cleanSessionId = match[1];
    }
  }
  
  console.log('[CashfreeClient] Cleaned session ID:', cleanSessionId);
  
  return {
    order_id: String(parsed.order_id || ''),
    payment_session_id: cleanSessionId
  };
}

async function fetchOrder(orderId) {
  const response = await axios.get(`${BASE_URL}/orders/${orderId}`, { headers: headers() });
  const rawText = JSON.stringify(response.data);
  return JSON.parse(rawText);
}

module.exports = { createOrder, fetchOrder };