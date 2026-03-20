"""Webhook handlers for Stripe."""
from __future__ import annotations

import hashlib
import logging
import secrets

import stripe
from fastapi import APIRouter, HTTPException, Request

from .. import db
from .. import redis as app_redis
from ..config import settings
from ..deps import limiter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["webhooks"])


# =============================================================================
# Stripe Webhook — checkout.session.completed, invoice.paid, subscription deleted
# =============================================================================

@router.post("/webhooks/stripe")
@limiter.limit("60/minute")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(500, "Stripe webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            body, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        logger.warning("Stripe webhook signature verification failed")
        raise HTTPException(400, "Invalid webhook signature")
    except ValueError:
        raise HTTPException(400, "Invalid payload")

    event_type = event["type"]
    obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(obj)
    elif event_type == "invoice.paid":
        await _handle_invoice_paid(obj)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(obj)
    else:
        logger.debug(f"Unhandled Stripe event: {event_type}")

    return {"status": "ok"}


async def _handle_checkout_completed(session: dict):
    """Process successful checkout — add credits, activate Pro, or fulfil guest purchase."""
    metadata = session.get("metadata", {})
    plan = metadata.get("plan")

    # Guest single purchase — no user_id required
    if plan == "guest_single":
        await _handle_guest_checkout(session, metadata)
        return

    user_id = metadata.get("user_id")
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    payment_intent = session.get("payment_intent")

    if not user_id or not plan:
        logger.warning(f"Checkout session missing metadata: {session.get('id')}")
        return

    logger.info(f"Checkout completed: user_id={user_id}, plan={plan}")

    async with db.pool.connection() as conn:
        if plan == "single":
            await conn.execute(
                """
                INSERT INTO report_credits (user_id, credit_type, credits_remaining,
                    stripe_payment_id, stripe_customer_id)
                VALUES (%s, 'single', 1, %s, %s)
                """,
                [user_id, payment_intent, customer_id],
            )
            await conn.execute(
                "UPDATE users SET plan = 'single', updated_at = now() WHERE user_id = %s AND plan = 'free'",
                [user_id],
            )

        elif plan == "pack3":
            await conn.execute(
                """
                INSERT INTO report_credits (user_id, credit_type, credits_remaining,
                    stripe_payment_id, stripe_customer_id)
                VALUES (%s, 'pack3', 3, %s, %s)
                """,
                [user_id, payment_intent, customer_id],
            )
            await conn.execute(
                "UPDATE users SET plan = 'pack3', updated_at = now() WHERE user_id = %s AND plan IN ('free', 'single')",
                [user_id],
            )

        elif plan == "pro":
            await conn.execute(
                """
                INSERT INTO report_credits (user_id, credit_type, credits_remaining,
                    daily_limit, monthly_limit, stripe_subscription_id, stripe_customer_id,
                    expires_at)
                VALUES (%s, 'pro', 0, 10, 30, %s, %s,
                    now() + INTERVAL '1 month')
                """,
                [user_id, subscription_id, customer_id],
            )
            await conn.execute(
                "UPDATE users SET plan = 'pro', updated_at = now() WHERE user_id = %s",
                [user_id],
            )


async def _handle_invoice_paid(invoice: dict):
    """Extend Pro subscription expiry on recurring payment."""
    subscription_id = invoice.get("subscription")
    if not subscription_id:
        return

    async with db.pool.connection() as conn:
        await conn.execute(
            """
            UPDATE report_credits
            SET expires_at = now() + INTERVAL '1 month'
            WHERE stripe_subscription_id = %s AND cancelled_at IS NULL
            """,
            [subscription_id],
        )
    logger.info(f"Pro subscription extended: {subscription_id}")


async def _handle_subscription_deleted(subscription: dict):
    """Downgrade user when Pro subscription is cancelled."""
    subscription_id = subscription.get("id")
    if not subscription_id:
        return

    async with db.pool.connection() as conn:
        # Mark credit as cancelled
        cur = await conn.execute(
            """
            UPDATE report_credits
            SET cancelled_at = now()
            WHERE stripe_subscription_id = %s
            RETURNING user_id
            """,
            [subscription_id],
        )
        row = cur.fetchone()
        if row:
            user_id = row["user_id"]
            # Check if user has any other active credits
            cur2 = await conn.execute(
                """
                SELECT 1 FROM report_credits
                WHERE user_id = %s
                  AND cancelled_at IS NULL
                  AND (expires_at IS NULL OR expires_at > now())
                  AND (credits_remaining > 0 OR credit_type = 'pro')
                LIMIT 1
                """,
                [user_id],
            )
            if not cur2.fetchone():
                await conn.execute(
                    "UPDATE users SET plan = 'free', updated_at = now() WHERE user_id = %s",
                    [user_id],
                )
                logger.info(f"User downgraded to free: {user_id}")

    logger.info(f"Subscription cancelled: {subscription_id}")


async def _handle_guest_checkout(session: dict, metadata: dict):
    """Fulfil a guest (no-account) single report purchase."""
    session_id = session.get("id")
    email = (session.get("customer_details") or {}).get("email", "")
    address_id = metadata.get("address_id")
    persona = metadata.get("persona", "buyer")

    if not email or not address_id:
        logger.warning(f"Guest checkout missing email/address_id: {session_id}")
        return

    # Generate a one-time download token
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    async with db.pool.connection() as conn:
        await conn.execute(
            """
            INSERT INTO guest_purchases
                (stripe_session_id, email, address_id, persona, download_token_hash)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (stripe_session_id) DO NOTHING
            """,
            [session_id, email, int(address_id), persona, token_hash],
        )

    # Store plaintext token in Redis for 5-minute exchange window
    if app_redis.redis_client:
        try:
            await app_redis.redis_client.set(
                f"guest_token:{session_id}", token, ex=300
            )
        except Exception as e:
            logger.error(f"Failed to store guest token in Redis: {e}")

    logger.info(f"Guest purchase fulfilled: session={session_id}, email={email}")
