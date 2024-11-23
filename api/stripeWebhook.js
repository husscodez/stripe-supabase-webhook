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
        console.log('Received POST request at webhook.');
        console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);
console.log('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET);
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);

        // Ensure all environment variables are present
        if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.SUPABASE_KEY) {
            console.error('Missing environment variables!');
            res.status(500).send('Internal Server Error: Missing environment variables');
            return;
        }

        if (req.method === 'POST') {
            const rawBody = await getRawBody(Readable.from(req));
            const sig = req.headers['stripe-signature'];

            console.log('Raw body:', rawBody);
            console.log('Stripe signature:', sig);

            // Verify Stripe webhook signature
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

            console.log('Stripe event verified:', event.type);

            if (event.type === 'payment_intent.succeeded') {
                const paymentIntent = event.data.object;
                console.log('Payment intent object:', paymentIntent);

                // Send data to Supabase
                try {
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
                } catch (err) {
                    console.error('Error inserting into Supabase:', err.message);
                    res.status(500).send(`Supabase Insert Error: ${err.message}`);
                    return;
                }
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
