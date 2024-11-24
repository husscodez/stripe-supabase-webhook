console.log({
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
});


import { Readable } from 'stream';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function getRawBody(readable) {
    return new Promise((resolve, reject) => {
        let data = '';
        readable.on('data', (chunk) => {
            data += chunk;
        });
        readable.on('end', () => {
            resolve(data);
        });
        readable.on('error', (err) => {
            reject(err);
        });
    });
}

export default async (req, res) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.SUPABASE_KEY || !process.env.SUPABASE_URL) {
            console.error('Missing environment variables!');
            res.status(500).send('Internal Server Error: Missing environment variables');
            return;
        }

        if (req.method === 'POST') {
            const rawBody = await getRawBody(Readable.from(req));
            const sig = req.headers['stripe-signature'];

            let event;
            try {
                event = stripe.webhooks.constructEvent(
                    rawBody,
                    sig,
                    process.env.STRIPE_WEBHOOK_SECRET
                );
            } catch (err) {
                console.error('Stripe signature verification failed:', err.message);
                res.status(400).send(`Webhook Error: ${err.message}`);
                return;
            }

            if (event.type === 'payment_intent.succeeded') {
                const paymentIntent = event.data.object;

                try {
                    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/Payments`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': process.env.SUPABASE_KEY,
                        },
                        body: JSON.stringify({
                            payment_id: paymentIntent.id,
                            amount: paymentIntent.amount,
                            currency: paymentIntent.currency,
                            status: paymentIntent.status,
                        }),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Supabase Insert Error:', response.status, errorText);
                        throw new Error('Failed to insert payment into Supabase');
                    }
                } catch (err) {
                    console.error('Supabase Error:', err.message);
                    res.status(500).send(`Supabase Insert Error: ${err.message}`);
                    return;
                }
            }

            res.status(200).send({ received: true });
        } else {
            res.status(405).send('Method Not Allowed');
        }
    } catch (err) {
        console.error('Error occurred in webhook handler:', err.message);
        res.status(500).send(`Webhook Error: ${err.message}`);
    }
};
