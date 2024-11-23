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
        if (req.method === 'POST') {
            const rawBody = await getRawBody(Readable.from(req));
            const sig = req.headers['stripe-signature'];

            const event = stripe.webhooks.constructEvent(
                rawBody,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );

            console.log('Stripe event verified:', event.type);

            if (event.type === 'payment_intent.succeeded') {
                const paymentIntent = event.data.object;
                console.log('Payment intent:', paymentIntent);

                const response = await fetch(
                    'https://mvlqlgpeqieuayciriij.supabase.co/rest/v1/Payments',
                    {
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
                    }
                );

                if (!response.ok) {
                    console.error('Supabase Error:', response.status, await response.text());
                    throw new Error('Failed to insert payment into Supabase');
                }

                console.log('Payment inserted into Supabase successfully.');
            }

            res.status(200).send({ received: true });
        } else {
            res.status(405).send('Method Not Allowed');
        }
    } catch (err) {
        console.error('Error occurred:', err.message);
        res.status(500).send(`Webhook Error: ${err.message}`);
    }
};
