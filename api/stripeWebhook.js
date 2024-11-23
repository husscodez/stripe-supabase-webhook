import { buffer } from 'micro';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Disable body parsing for raw request handling
export const config = { api: { bodyParser: false } };

export default async (req, res) => {
    // CORS header (optional, for local testing)
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'POST') {
        try {
            // Parse the raw body
            const rawBody = await buffer(req);
            const sig = req.headers['stripe-signature'];

            // Verify Stripe webhook signature
            const event = stripe.webhooks.constructEvent(
                rawBody,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );

            console.log('Received Stripe event:', event.type);

            // Handle specific event types
            if (event.type === 'payment_intent.succeeded') {
                const paymentIntent = event.data.object;
                console.log('Payment succeeded:', paymentIntent.id);

                // Send payment data to Supabase
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
                    console.error(
                        'Supabase insertion error:',
                        response.status,
                        await response.text()
                    );
                    throw new Error('Failed to insert data into Supabase');
                }

                console.log('Payment data inserted into Supabase.');
            }

            // Respond to Stripe
            res.status(200).send({ received: true });
        } catch (err) {
            console.error('Webhook handler error:', err.message);
            res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        console.log('Unsupported HTTP method');
        res.status(405).send('Method Not Allowed');
    }
};
