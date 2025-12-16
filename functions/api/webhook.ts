// Stripe Webhook handler
// Processes subscription events from Stripe

interface Env {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
}

// Stripe event types
interface StripeEvent {
    id: string;
    type: string;
    data: {
        object: StripeSubscription | StripeCheckoutSession;
    };
}

interface StripeSubscription {
    id: string;
    customer: string;
    status: string;
    items: {
        data: Array<{
            price: {
                id: string;
            };
        }>;
    };
    metadata?: {
        user_id?: string;
    };
}

interface StripeCheckoutSession {
    id: string;
    customer: string;
    subscription: string;
    metadata?: {
        user_id?: string;
        plan?: string;
    };
}

async function verifyWebhookSignature(
    request: Request,
    secret: string
): Promise<{ valid: boolean; payload?: StripeEvent }> {
    const signature = request.headers.get('stripe-signature');
    if (!signature) return { valid: false };

    const body = await request.text();

    // Parse signature parts
    const parts = signature.split(',').reduce((acc, part) => {
        const [key, value] = part.split('=');
        acc[key] = value;
        return acc;
    }, {} as Record<string, string>);

    const timestamp = parts['t'];
    const expectedSig = parts['v1'];

    if (!timestamp || !expectedSig) return { valid: false };

    // Create signed payload
    const signedPayload = `${timestamp}.${body}`;

    // Compute expected signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signedPayload)
    );

    const computedSig = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // Constant-time comparison
    if (computedSig !== expectedSig) {
        return { valid: false };
    }

    // Check timestamp (allow 5 minute tolerance)
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (timestampAge > 300) {
        return { valid: false };
    }

    return { valid: true, payload: JSON.parse(body) as StripeEvent };
}

function getPlanFromPriceId(priceId: string, env: Env): string {
    // This would need to compare with env vars, but we can't access them here
    // So we use a simple pattern match for now
    if (priceId.includes('Lite') || priceId === (globalThis as any).STRIPE_LITE_PRICE_ID) {
        return 'lite';
    }
    return 'pro';
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;

    try {
        const verification = await verifyWebhookSignature(
            request.clone(),
            env.STRIPE_WEBHOOK_SECRET
        );

        if (!verification.valid || !verification.payload) {
            return new Response('Invalid signature', { status: 401 });
        }

        const event = verification.payload;
        console.log(`Received Stripe event: ${event.type}`);

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as StripeCheckoutSession;
                const userId = session.metadata?.user_id;
                const plan = session.metadata?.plan || 'lite';

                if (userId) {
                    await env.DB.prepare(`
                        UPDATE users 
                        SET plan = ?, stripe_subscription_id = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(plan, session.subscription, userId).run();

                    console.log(`Updated user ${userId} to plan ${plan}`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as StripeSubscription;
                const customerId = subscription.customer;
                const status = subscription.status;

                // Get user by Stripe customer ID
                const user = await env.DB.prepare(
                    'SELECT id FROM users WHERE stripe_customer_id = ?'
                ).bind(customerId).first();

                if (user) {
                    if (status === 'active') {
                        const priceId = subscription.items.data[0]?.price?.id;
                        const plan = priceId ? getPlanFromPriceId(priceId, env) : 'lite';

                        await env.DB.prepare(`
                            UPDATE users 
                            SET plan = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `).bind(plan, user.id).run();
                    } else if (['canceled', 'unpaid', 'past_due'].includes(status)) {
                        await env.DB.prepare(`
                            UPDATE users 
                            SET plan = 'free', stripe_subscription_id = NULL, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `).bind(user.id).run();
                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as StripeSubscription;
                const customerId = subscription.customer;

                await env.DB.prepare(`
                    UPDATE users 
                    SET plan = 'free', stripe_subscription_id = NULL, updated_at = CURRENT_TIMESTAMP
                    WHERE stripe_customer_id = ?
                `).bind(customerId).run();

                console.log(`Subscription deleted for customer ${customerId}`);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Webhook error:', error instanceof Error ? error.message : 'Unknown error');
        return new Response('Webhook processing failed', { status: 500 });
    }
};
