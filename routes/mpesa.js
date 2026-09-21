const express = require('express');
const axios = require('axios');
const db = require('../db');
const router = express.Router();

const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
  MPESA_ENVIRONMENT
} = process.env;

const BASE_URL = MPESA_ENVIRONMENT === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

async function getAccessToken() {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return res.data.access_token;
}

function generatePassword() {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
  return { password, timestamp };
}

function formatPhone(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  if (!p.startsWith('254')) p = '254' + p;
  return p;
}

router.post('/pay', async (req, res) => {
  try {
    const { campaignId, phone, amount, donorName } = req.body;

    if (!campaignId || !phone || !amount) {
      return res.status(400).json({ error: 'campaignId, phone, and amount are required' });
    }

    const amt = Math.floor(Number(amount));
    if (amt < 1) return res.status(400).json({ error: 'Amount must be at least KES 1' });

    const campaign = db.prepare('SELECT id, title FROM campaigns WHERE id = ? AND status = ?')
      .get(campaignId, 'approved');
    if (!campaign) return res.status(404).json({ error: 'Campaign not found or not approved' });

    const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 3);
    const fee = Math.floor((amt * feePercent) / 100);
    const net = amt - fee;

    const formattedPhone = formatPhone(phone);
    const token = await getAccessToken();
    const { password, timestamp } = generatePassword();

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amt,
      PartyA: formattedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: `CAMP-${campaign.id}`,
      TransactionDesc: `Donation to ${campaign.title}`.slice(0, 100)
    };

    const stkRes = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const checkoutId = stkRes.data.CheckoutRequestID;

    db.prepare(`
      INSERT INTO donations
        (campaign_id, donor_name, donor_phone, amount, fee, net_amount, checkout_request_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(campaign.id, donorName || 'Anonymous', formattedPhone, amt, fee, net, checkoutId);

    res.json({
      success: true,
      message: 'Enter your M-Pesa PIN on your phone to complete the donation.',
      checkoutRequestId: checkoutId
    });

  } catch (err) {
    console.error('STK Push error:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to initiate M-Pesa payment',
      details: err.response?.data?.errorMessage || err.message
    });
  }
});

router.post('/callback', (req, res) => {
  try {
    const cb = req.body?.Body?.stkCallback;
    if (!cb) return res.json({ ResultCode: 0, ResultDesc: 'Ignored' });

    const checkoutId = cb.CheckoutRequestID;
    const donation = db.prepare('SELECT * FROM donations WHERE checkout_request_id = ?').get(checkoutId);

    if (!donation) {
      console.warn('Callback for unknown checkout:', checkoutId);
      return res.json({ ResultCode: 0, ResultDesc: 'Unknown' });
    }

    if (cb.ResultCode === 0) {
      const items = cb.CallbackMetadata.Item;
      const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE donations
          SET status = 'completed', mpesa_receipt = ?
          WHERE id = ? AND status = 'pending'
        `).run(receipt, donation.id);

        const updated = db.prepare('SELECT changes() AS c').get();
        if (updated.c > 0) {
          db.prepare(`
            UPDATE campaigns
            SET raised_amount = raised_amount + ?
            WHERE id = ?
          `).run(donation.net_amount, donation.campaign_id);
        }
      });
      tx();

      console.log(`✓ Donation completed: ${receipt} — KES ${donation.amount}`);
    } else {
      db.prepare("UPDATE donations SET status = 'failed' WHERE id = ?").run(donation.id);
      console.log(`✗ Payment failed (${cb.ResultCode}): ${cb.ResultDesc}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (err) {
    console.error('Callback error:', err);
    res.json({ ResultCode: 0, ResultDesc: 'Error handled' });
  }
});

router.get('/status/:checkoutId', (req, res) => {
  const donation = db.prepare(`
    SELECT status, mpesa_receipt, amount FROM donations WHERE checkout_request_id = ?
  `).get(req.params.checkoutId);

  if (!donation) return res.status(404).json({ error: 'Not found' });
  res.json(donation);
});

module.exports = router;