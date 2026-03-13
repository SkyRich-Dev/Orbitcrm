import { storage } from "./storage";

export interface PaymentGatewayResult {
  success: boolean;
  sessionUrl?: string;
  subscriptionId?: string;
  customerId?: string;
  error?: string;
}

export class StripeService {
  private stripe: any = null;

  private async getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    if (!this.stripe) {
      const Stripe = (await import("stripe")).default;
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return this.stripe;
  }

  isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
  }

  async createCheckoutSession(params: {
    companyId: number;
    planId: number;
    billingCycle: "monthly" | "yearly";
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<PaymentGatewayResult> {
    const stripe = await this.getStripe();
    if (!stripe) return { success: false, error: "Stripe not configured" };

    try {
      const plan = await storage.getSubscriptionPlan(params.planId);
      if (!plan) return { success: false, error: "Plan not found" };

      const price = params.billingCycle === "yearly" ? Number(plan.priceYearly) : Number(plan.priceMonthly);
      if (price <= 0) return { success: false, error: "Invalid plan price" };

      const priceId = params.billingCycle === "yearly" ? plan.stripePriceYearlyId : plan.stripePriceMonthlyId;

      let sessionConfig: any = {
        mode: "subscription",
        customer_email: params.customerEmail,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          companyId: String(params.companyId),
          planId: String(params.planId),
          billingCycle: params.billingCycle,
        },
      };

      if (priceId) {
        sessionConfig.line_items = [{ price: priceId, quantity: 1 }];
      } else {
        sessionConfig.line_items = [{
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: { name: `${plan.name} Plan (${params.billingCycle})` },
            unit_amount: Math.round(price * 100),
            recurring: { interval: params.billingCycle === "yearly" ? "year" : "month" },
          },
          quantity: 1,
        }];
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);
      return { success: true, sessionUrl: session.url };
    } catch (err: any) {
      console.error("Stripe checkout error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async handleWebhook(payload: string, signature: string): Promise<{ type: string; data: any } | null> {
    const stripe = await this.getStripe();
    if (!stripe) return null;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return null;
    }

    try {
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return { type: event.type, data: event.data.object };
    } catch (err: any) {
      console.error("Stripe webhook verification failed:", err.message);
      return null;
    }
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<PaymentGatewayResult> {
    const stripe = await this.getStripe();
    if (!stripe) return { success: false, error: "Stripe not configured" };

    try {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export class RazorpayService {
  private razorpay: any = null;

  private getRazorpay() {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
    if (!this.razorpay) {
      try {
        const Razorpay = require("razorpay");
        this.razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
      } catch {
        return null;
      }
    }
    return this.razorpay;
  }

  isConfigured(): boolean {
    return !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
  }

  async createSubscription(params: {
    companyId: number;
    planId: number;
    billingCycle: "monthly" | "yearly";
    customerEmail: string;
    customerName: string;
  }): Promise<PaymentGatewayResult> {
    const razorpay = this.getRazorpay();
    if (!razorpay) return { success: false, error: "Razorpay not configured" };

    try {
      const plan = await storage.getSubscriptionPlan(params.planId);
      if (!plan) return { success: false, error: "Plan not found" };

      const rpPlanId = params.billingCycle === "yearly" ? plan.razorpayPlanYearlyId : plan.razorpayPlanMonthlyId;
      if (!rpPlanId) return { success: false, error: "Razorpay plan not configured for this billing cycle" };

      const subscription = await razorpay.subscriptions.create({
        plan_id: rpPlanId,
        total_count: params.billingCycle === "yearly" ? 10 : 120,
        notes: {
          companyId: String(params.companyId),
          planId: String(params.planId),
          billingCycle: params.billingCycle,
        },
      });

      return {
        success: true,
        subscriptionId: subscription.id,
      };
    } catch (err: any) {
      console.error("Razorpay subscription error:", err.message);
      return { success: false, error: err.message };
    }
  }

  verifyPaymentSignature(params: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;

    try {
      const crypto = require("crypto");
      const generated = crypto
        .createHmac("sha256", secret)
        .update(`${params.razorpay_payment_id}|${params.razorpay_subscription_id}`)
        .digest("hex");
      return generated === params.razorpay_signature;
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;

    try {
      const crypto = require("crypto");
      const generated = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");
      return generated === signature;
    } catch {
      return false;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<PaymentGatewayResult> {
    const razorpay = this.getRazorpay();
    if (!razorpay) return { success: false, error: "Razorpay not configured" };

    try {
      await razorpay.subscriptions.cancel(subscriptionId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const stripeService = new StripeService();
export const razorpayService = new RazorpayService();
