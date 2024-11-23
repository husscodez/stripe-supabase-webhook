export default async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow requests from any origin
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); // Allow GET and POST requests

    if (req.method === 'GET') {
        res.status(200).send('Webhook endpoint is live!');
    } else if (req.method === 'POST') {
        console.log('Received Stripe event:', req.body);
        res.status(200).send({ received: true });
    } else {
        res.status(405).send('Method Not Allowed');
    }
};
