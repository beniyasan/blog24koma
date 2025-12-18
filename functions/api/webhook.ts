// Stripe Webhook handler
// Processes subscription events from Stripe

interface Env {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_LITE_PRICE_ID: string;
    STRIPE_PRO_PRICE_ID: string;
}

// Stripe event types
interface StripeEvent {
    id: string;
    type: string;
    created?: number;
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

    // Parse signature parts (Stripe may send multiple v1 values)
    const timestamp = signature
        .split(',')
        .map(p => p.trim())
        .find(p => p.startsWith('t='))
        ?.slice(2);

    const expectedSigs = signature
        .split(',')
        .map(p => p.trim())
        .filter(p => p.startsWith('v1='))
        .map(p => p.slice(3));

    if (!timestamp || expectedSigs.length === 0) return { valid: false };

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

    const constantTimeEqual = (a: string, b: string): boolean => {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return diff === 0;
    };

    const sigValid = expectedSigs.some(sig => constantTimeEqual(computedSig, sig));
    if (!sigValid) return { valid: false };

    // Check timestamp (allow 5 minute tolerance)
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (timestampAge > 300) {
        return { valid: false };
    }

    return { valid: true, payload: JSON.parse(body) as StripeEvent };
}

function getPlanFromPriceId(priceId: string, env: Env): string {
    if (priceId === env.STRIPE_LITE_PRICE_ID) return 'lite';
    if (priceId === env.STRIPE_PRO_PRICE_ID) return 'pro';
    return 'pro';
}

async function recordStripeEvent(env: Env, event: StripeEvent): Promise<boolean> {
    try {
        const res = await env.DB.prepare(`
            INSERT INTO stripe_events (id, type, created, received_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO NOTHING
        `).bind(event.id, event.type, event.created ?? null).run();

        // If changes === 0, this event was already recorded
        const changes = (res as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
        return changes > 0;
    } catch (e) {
        console.warn('Failed to record Stripe event (non-blocking):', e);
        return true;
    }
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

        const isNewEvent = await recordStripeEvent(env, event);
        if (!isNewEvent) {
            console.log(`Duplicate Stripe event ignored: ${event.id}`);
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

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
