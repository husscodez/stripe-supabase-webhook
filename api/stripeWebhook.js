export default async (req, res) => {
    console.log('Request received');

    if (req.method === 'POST') {
        const rawBody = await buffer(req);
        console.log('Raw body parsed:', rawBody);

        const sig = req.headers['stripe-signature'];
        console.log('Stripe signature:', sig);

        try {
            const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
            console.log('Stripe event constructed:', event);

            // Handle event types here
            res.status(200).send({ received: true });
        } catch (err) {
            console.error('Error:', err.message);
            res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        console.log('Unsupported method');
        res.status(405).send('Method Not Allowed');
    }
};
