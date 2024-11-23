export default async (req, res) => {
    if (req.method === 'GET') {
        // Respond to GET requests (useful for testing)
        res.status(200).send('Webhook endpoint is live!');
    } else if (req.method === 'POST') {
        // Respond to POST requests (Stripe will send events here)
        console.log('Received Stripe event:', req.body);

        // Acknowledge receipt of the webhook event
        res.status(200).send({ received: true });
    } else {
        // Handle unsupported HTTP methods
        res.status(405).send('Method Not Allowed');
    }
};
