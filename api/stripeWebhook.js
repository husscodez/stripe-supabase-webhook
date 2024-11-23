import { buffer } from 'micro'; // For raw request body
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } }; // Disable body parser for raw body

export default async (req, res) => {
    if (req.method === 'POST') {
        const rawBody = await buffer(req);
        const sig = req.headers['stripe-signature'];

        try {
            // Verify the Stripe event
            const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);

            console.log('Verified event:', event);

            // Handle the event type (example: checkout.session.completed)
            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;

                console.log('Checkout session completed! Customer Email:', session.customer_email);

                // Send data to Supabase
                await fetch('https://mvlqlgpeqieuayciriij.supabase.co/rest/v1/Users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': process.env.SUPABASE_KEY,
                    },
                    body: JSON.stringify({
                        email: session.customer_email, // Adjust according to event data
                        subscription_status: 'active',
                    }),
                });

                console.log('Data sent to Supabase successfully.');
            }

            res.status(200).send({ received: true });
        } catch (err) {
            console.error('Webhook error:', err.message);
            res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        res.status(405).send('Method Not Allowed');
    }
};
