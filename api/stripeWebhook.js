export default async (req, res) => {
    try {
        console.log('Received request:', req.method);

        if (req.method === 'POST') {
            const rawBody = await buffer(req);
            console.log('Raw body:', rawBody.toString());

            const sig = req.headers['stripe-signature'];
            console.log('Signature:', sig);

            const event = stripe.webhooks.constructEvent(
                rawBody,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );

            console.log('Stripe event verified:', event.type);

            if (event.type === 'payment_intent.succeeded') {
                const paymentIntent = event.data.object;
                console.log('Processing payment intent:', paymentIntent);

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
                    const errorText = await response.text();
                    console.error('Supabase Error:', response.status, errorText);
                    throw new Error('Failed to insert payment into Supabase');
                }

                console.log('Payment inserted into Supabase successfully.');
            }

            res.status(200).send({ received: true });
        } else {
            console.log('Unsupported method:', req.method);
            res.status(405).send('Method Not Allowed');
        }
    } catch (err) {
        console.error('Error occurred:', err.message);
        res.status(500).send(`Internal Server Error: ${err.message}`);
    }
};
