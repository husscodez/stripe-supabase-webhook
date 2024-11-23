import { buffer } from 'micro'; // For reading raw request body
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } }; // Disable body parser for raw body

export default async (req, res) => {
    if (req.method === 'POST') {
        const rawBody = await buffer(req);
        const sig = req.headers['stripe-signature'];

        try {
            const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
            console.log('Verified event:', event);

            // Handle event types
            if (event.type === 'checkout.session.completed') {
                console.log('Checkout session completed!', event.data.object);
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
