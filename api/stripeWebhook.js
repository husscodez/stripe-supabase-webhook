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
            console.log('Received POST request at webhook.');

            const rawBody = await getRawBody(Readable.from(req));
            const sig = req.headers['stripe-signature'];

            console.log('Raw body:', rawBody);
            console.log('Stripe signature:', sig);

            // Verify Stripe event
            const event = stripe.webhooks.constructEvent(
                rawBody,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );

            console.log('Stripe event verified:', event.type);

            // Handle specific event types
            if (event.type === 'payment_intent.succeeded') {
                const paymentIntent = event.data.object;
                console.log('Payment intent object:', paymentIntent);

                // Send data to Supabase
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

                const responseText = await response.text();
                console.log('Supabase Response Status:', response.status);
                console.log('Supabase Response Body:', responseText);

                if (!response.ok) {
                    console.error('Supabase Error:', response.status, responseText);
                    throw new Error('Failed to insert payment into Supabase');
                }

                console.log('Payment successfully inserted into Supabase.');
            }

            res.status(200).send({ received: true });
        } else {
            console.log('Received unsupported HTTP method:', req.method);
            res.status(405).send('Method Not Allowed');
        }
    } catch (err) {
        console.error('Error occurred in webhook handler:', err.message);
        res.status(500).send(`Webhook Error: ${err.message}`);
    }
};
